export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
type GroupAdminArgs = {
  p_expected_user_id: string;
  p_operation_id: string;
  p_group_id: string;
  p_expected_revision: number;
};

export type Database = {
  public: {
    Tables: {
      groups: Table<{
        id: string;
        name: string;
        created_by: string;
        invite_code: string;
        created_at: string;
        currency: string;
        revision: number;
        archived_at: string | null;
        invite_expires_at: string;
      }>;
      group_access: Table<{
        group_id: string;
        user_id: string;
        role: 'owner' | 'member';
        created_at: string;
      }>;
      group_members: Table<{
        id: string;
        group_id: string;
        name: string;
        created_at: string;
        deactivated_at: string | null;
        user_id: string | null;
      }>;
      group_expenses: Table<{
        id: string;
        group_id: string;
        description: string;
        amount: number;
        paid_by_member_id: string;
        date: string;
        kind: 'expense' | 'settlement' | 'refund';
        created_at: string;
        currency: string;
        contributions: Json;
        split_inputs: Json | null;
        itemized: Json | null;
        conversion: Json | null;
        category: string;
        notes: string;
        method: string;
        reference: string;
        author_id: string | null;
        updated_at: string;
        revision: number;
        deleted_at: string | null;
        refund_of_id: string | null;
        refund_snapshot: Json | null;
      }>;
      expense_splits: Table<{ expense_id: string; member_id: string; amount: number }>;
      group_activity: Table<{
        id: string;
        group_id: string;
        expense_id: string | null;
        actor_id: string | null;
        action: string;
        text: string;
        details: string;
        created_at: string;
      }>;
      group_operation_receipts: Table<{
        id: string;
        group_id: string;
        actor_id: string;
        snapshot_hash: string;
        revision: number;
        before_snapshot: Json | null;
        after_snapshot: Json;
        created_at: string;
      }>;
      group_administrative_operations: Table<{
        id: string;
        group_id: string;
        actor_id: string;
        request_hash: string;
        action: string;
        response: Json;
        created_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      get_group_administration: {
        Args: { p_expected_user_id: string; p_group_id: string };
        Returns: Json;
      };
      rotate_group_invite: { Args: GroupAdminArgs & { p_expires_in_hours: number }; Returns: Json };
      transfer_group_ownership: {
        Args: GroupAdminArgs & { p_target_user_id: string };
        Returns: Json;
      };
      remove_group_access: {
        Args: GroupAdminArgs & { p_target_user_id: string; p_acknowledge_ledger: boolean };
        Returns: Json;
      };
      leave_shared_group: {
        Args: GroupAdminArgs & { p_acknowledge_ledger: boolean };
        Returns: Json;
      };
      get_shared_group_snapshots: { Args: { p_expected_user_id: string }; Returns: Json };
      apply_group_operation: {
        Args: {
          p_expected_user_id: string;
          p_operation_id: string;
          p_group_id: string;
          p_base_revision: number;
          p_snapshot: Json;
        };
        Returns: Json;
      };
      create_shared_group: {
        Args: { p_group_id: string; p_name: string; p_created_at: string; p_members: Json };
        Returns: { group_id: string; invite_code: string }[];
      };
      join_group_by_invite: {
        Args: { p_invite_code: string; p_expected_user_id: string };
        Returns: string;
      };
      get_personal_backup: {
        Args: { p_expected_user_id: string };
        Returns: { document: Json; revision: number; updated_at: string }[];
      };
      save_personal_backup: {
        Args: { p_expected_user_id: string; p_document: Json; p_expected_revision: number };
        Returns: number;
      };
      delete_personal_backup: {
        Args: { p_expected_user_id: string; p_expected_revision: number };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
