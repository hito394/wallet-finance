import { redirect } from "next/navigation";

// Dashboard has been merged into the Home page.
export default function DashboardPage() {
  redirect("/");
}
