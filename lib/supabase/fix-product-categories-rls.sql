-- ============================================================================
-- إصلاح: جدول product_categories معطّل بالكامل
-- ============================================================================
-- العَرَض:  صفحة "الأصناف" تعرض خطأ Minified React error #441 ولا تحمّل شيئاً.
-- السبب:   سياسة RLS على public.product_categories تشير إلى العمود
--          tenants.user_id — وهذا العمود اسمه في قاعدتك auth_user_id.
--          نتيجةً لذلك أي استعلام على الجدول يفشل بـ:
--              42703: column "user_id" does not exist
--          و fetchProductsFullAction يعمل join معه:
--              .select("*, product_categories(name)")
--          فتنهار صفحة الأصناف كلها معه.
--
-- الحل:    نحذف كل سياسات product_categories المكسورة، ثم نستنسخ سياسات
--          جدول products نفسه عليها — فتصير الحماية متطابقة تماماً مع باقي
--          الجداول، بلا تخمين لصيغة السياسة الصحيحة.
--
-- الملف آمن للتشغيل أكثر من مرة (idempotent) ولا يمسّ أي بيانات.
-- نفّذه في: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1) تشخيص قبل الإصلاح — انظر النتيجة في تبويب Results
-- ─────────────────────────────────────────────────────────────────────────────
select
  'BEFORE' as stage,
  tablename,
  policyname,
  cmd,
  qual        as using_expression,
  with_check  as check_expression
from pg_policies
where schemaname = 'public'
  and tablename in ('products', 'product_categories')
order by tablename, policyname;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) الإصلاح: حذف سياسات product_categories واستنساخ سياسات products
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  pol           record;
  cloned_count  int := 0;
  roles_list    text;
  using_part    text;
  check_part    text;
begin
  -- التأكد أن الجدول موجود قبل أي شيء
  if to_regclass('public.product_categories') is null then
    raise exception 'الجدول public.product_categories غير موجود — أوقفنا التنفيذ';
  end if;

  -- (أ) احذف كل سياسة حالية على product_categories (كلها مكسورة)
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'product_categories'
  loop
    execute format('drop policy %I on public.product_categories', pol.policyname);
    raise notice 'حُذفت السياسة المكسورة: %', pol.policyname;
  end loop;

  -- (ب) فعّل RLS (لا نترك الجدول مكشوفاً أبداً)
  execute 'alter table public.product_categories enable row level security';

  -- (ج) استنسخ سياسات products — نفس الحماية بالضبط
  for pol in
    select policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public' and tablename = 'products'
  loop
    roles_list := array_to_string(pol.roles, ', ');
    using_part := case when pol.qual       is not null
                       then ' using (' || pol.qual || ')'       else '' end;
    check_part := case when pol.with_check is not null
                       then ' with check (' || pol.with_check || ')' else '' end;

    execute format(
      'create policy %I on public.product_categories as %s for %s to %s%s%s',
      'pc_' || pol.policyname,
      case when pol.permissive = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
      lower(pol.cmd),
      roles_list,
      using_part,
      check_part
    );
    cloned_count := cloned_count + 1;
    raise notice 'أُنشئت السياسة: %', 'pc_' || pol.policyname;
  end loop;

  -- (د) شبكة أمان: لو ما في سياسات على products أصلاً، اكتب سياسة قياسية
  if cloned_count = 0 then
    raise notice 'لا توجد سياسات على products — سنكتب سياسة قياسية بدلاً منها';

    if to_regprocedure('public.current_tenant_id()') is not null then
      execute $pol$
        create policy pc_tenant_all on public.product_categories
          for all to authenticated
          using      (tenant_id = public.current_tenant_id())
          with check (tenant_id = public.current_tenant_id())
      $pol$;
    else
      execute $pol$
        create policy pc_tenant_all on public.product_categories
          for all to authenticated
          using (
            tenant_id in (select t.id from public.tenants t
                          where t.auth_user_id = auth.uid())
            or tenant_id in (select tu.tenant_id from public.tenant_users tu
                             where tu.auth_user_id = auth.uid() and tu.status = 'active')
          )
          with check (
            tenant_id in (select t.id from public.tenants t
                          where t.auth_user_id = auth.uid())
            or tenant_id in (select tu.tenant_id from public.tenant_users tu
                             where tu.auth_user_id = auth.uid() and tu.status = 'active')
          )
      $pol$;
    end if;
  end if;

  raise notice 'تم — عدد السياسات المستنسخة: %', cloned_count;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) بحث عن أي دالة أخرى ما زالت تشير إلى tenants.user_id
--    (لو ظهر أي صف هنا، أرسله لي — فيه بقايا من السكيما القديمة)
-- ─────────────────────────────────────────────────────────────────────────────
select
  'LEFTOVER FUNCTION' as stage,
  n.nspname  as schema,
  p.proname  as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and pg_get_functiondef(p.oid) ~* '\muser_id\M'
  and pg_get_functiondef(p.oid) ~* '\mtenants\M';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4) التحقق بعد الإصلاح — يجب أن يعمل بلا خطأ
-- ─────────────────────────────────────────────────────────────────────────────
select 'AFTER' as stage, count(*) as product_categories_rows
from public.product_categories;

select
  'AFTER' as stage, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'product_categories'
order by policyname;
