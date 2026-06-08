"use client";

import { StaffLoginForm } from "@/components/staff-login-form";

// Separate admin login URL (e.g. /admin/control/). The admin build sets
// BASE_PATH=/admin, so StaffLoginForm auto-detects role "admin" and signs in
// with mobile + password (no role dropdown). Not linked from the staff login.
// Marked "use client" (like /login) so client-side navigation in the Capacitor
// webview reliably hydrates the form instead of rendering blank.
export default function ControlPage() {
  return <StaffLoginForm />;
}
