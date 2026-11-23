export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      groups: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          invite_code: string;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          created_by: string;
          invite_code?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string;
          invite_code?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      group_access: {
        Row: {
          group_id: string;
          user_id: string;
          role: 'owner' | 'member';
          created_at: string;
        };
        Insert: {
          group_id: string;
          user_id: string;
          role?: 'owner' | 'member';
          created_at?: string;
        };
        Update: {
          group_id?: string;
          user_id?: string;
          role?: 'owner' | 'member';
          created_at?: string;
        };
        Relationships: [];
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id: string;
          group_id: string;
          name: string;
          created_at: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      group_expenses: {
        Row: {
          id: string;
          group_id: string;
          description: string;
          amount: number;
          paid_by_member_id: string;
          date: string;
          kind: 'expense' | 'settlement';
          created_at: string;
        };
        Insert: {
          id: string;
          group_id: string;
          description: string;
          amount: number;
          paid_by_member_id: string;
          date: string;
          kind: 'expense' | 'settlement';
          created_at: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          description?: string;
          amount?: number;
          paid_by_member_id?: string;
          date?: string;
          kind?: 'expense' | 'settlement';
          created_at?: string;
        };
        Relationships: [];
      };
      expense_splits: {
        Row: {
          expense_id: string;
          member_id: string;
          amount: number;
        };
        Insert: {
          expense_id: string;
          member_id: string;
          amount: number;
        };
        Update: {
          expense_id?: string;
          member_id?: string;
          amount?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_shared_group: {
        Args: {
          p_group_id: string;
          p_name: string;
          p_created_at: string;
          p_members: Json;
        };
        Returns: { group_id: string; invite_code: string }[];
      };
      join_group_by_invite: {
        Args: { p_invite_code: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
