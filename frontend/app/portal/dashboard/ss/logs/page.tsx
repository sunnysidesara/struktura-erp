import { redirect } from "next/navigation";

/** The sidebar links straight to each log; keep the bare URL working. */
export default function LogsIndexPage() {
  redirect("/portal/dashboard/ss/logs/workers");
}
