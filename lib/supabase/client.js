import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    "https://nbzctnypnblbsrpbxzbb.supabase.co",
    "sb_publishable_zI8mDpATpJDq3O5Szv7T1w_CcynL7bK"
  );
}