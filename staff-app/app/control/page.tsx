import { StaffLoginForm } from "@/components/staff-login-form";

// Separate admin login URL (e.g. /admin/control/). The admin build sets
// BASE_PATH=/admin, so StaffLoginForm auto-detects role "admin" and signs in
// with mobile + password (no role dropdown). Not linked from the staff login.
export default function ControlPage() {
  return <StaffLoginForm />;
}
