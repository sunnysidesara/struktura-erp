import { redirect } from "next/navigation";

/**
 * Account creation now happens in the "+ Create User" modal on the Users page,
 * so this legacy route just forwards to it with the modal pre-opened.
 */
export default function CreateUserPage() {
  redirect("/portal/dashboard/sa/users?create=1");
}
