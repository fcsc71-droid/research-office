import { EventsPage } from "@/components/app/events-page";
export const metadata = { title: "المؤتمرات والندوات وورش العمل" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <EventsPage institute={false} sp={await searchParams} />;
}
