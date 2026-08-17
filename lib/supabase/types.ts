// أنواع مطابقة لجداول قاعدة البيانات (يمكن توليدها تلقائياً لاحقاً عبر:
// npx supabase gen types typescript --project-id <id> > lib/supabase/types.ts)

export type TenantRow = {
  id: string
  user_id: string
  name: string
  owner_name: string
  email: string
  phone: string
  plan: "basic" | "professional" | "enterprise"
  status: "active" | "frozen" | "trial"
  industry: string
  currency: string
  expires_at: string | null
  created_at: string
}

export type UserRoleRow = {
  user_id: string
  role: "owner" | "client"
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: TenantRow
        Insert: Omit<TenantRow, "id" | "created_at">
        Update: Partial<Omit<TenantRow, "id" | "user_id" | "created_at">>
        Relationships: []
      }
      user_roles: {
        Row: UserRoleRow
        Insert: Omit<UserRoleRow, "created_at">
        Update: Partial<UserRoleRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
