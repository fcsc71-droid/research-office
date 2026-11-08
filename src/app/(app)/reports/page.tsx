import Link from "next/link";
import { BarChart3, FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildReport, parseReportFilters, REPORT_TYPES } from "@/lib/reports";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, EmptyState } from "@/components/app/misc";
import { FilterBar } from "@/components/app/filter-bar";
import { HorizontalBars } from "@/components/app/charts";
import { cn } from "@/lib/utils";

export const metadata = { title: "التقارير والإحصائيات" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("reports.view");
  const sp = await searchParams;
  const filters = parseReportFilters(sp);
  const [report, colleges, departments] = await Promise.all([
    buildReport(filters),
    db.college.findMany({ orderBy: { name: "asc" } }),
    db.department.findMany({ orderBy: { name: "asc" } }),
  ]);
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) q.set(k, String(v));
  const exportUrl = (format: string) => `/api/reports/export?${q}&format=${format}`;
  const chart =
    filters.type === "departments" ? report.rows.map((r) => ({ name: String(r[1]), value: Number(r[2]) })).filter((x) => x.value > 0)
    : filters.type === "researchers" ? report.rows.slice(0, 10).map((r) => ({ name: String(r[0]), value: Number(r[4]) + Number(r[5]) })).filter((x) => x.value > 0)
    : null;

  return (
    <div className="grid gap-5">
      <PageHeader icon={<BarChart3 />} title="التقارير والإحصائيات" description="اختر نوع التقرير وحدد الفترة الزمنية والمعايير ثم صدّره أو اطبعه" />
      <div className="no-print flex flex-wrap gap-2">
        {Object.entries(REPORT_TYPES).map(([k, v]) => (
          <Link key={k} href={`/reports?type=${k}${filters.from ? `&from=${filters.from}` : ""}${filters.to ? `&to=${filters.to}` : ""}`}
            className={cn("rounded-lg border px-3 py-2 text-sm font-semibold transition", filters.type === k ? "border-navy bg-navy text-white" : "bg-card hover:bg-accent")}>
            {v}
          </Link>
        ))}
      </div>
      <Card className="overflow-hidden">
        <FilterBar basePath="/reports" hidden={{ type: filters.type }} fields={[
          { type: "date", name: "from", label: "من تاريخ", value: filters.from },
          { type: "date", name: "to", label: "إلى تاريخ", value: filters.to },
          { type: "select", name: "collegeId", label: "الكلية", value: filters.collegeId, options: colleges.map((c) => ({ value: c.id, label: c.name })) },
          { type: "select", name: "departmentId", label: "القسم", value: filters.departmentId, options: departments.map((c) => ({ value: c.id, label: c.name })) },
          { type: "search", name: "q", value: filters.q, placeholder: "بحث وتصفية..." },
        ]} />
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{report.title}</CardTitle>
            <CardDescription>{report.subtitle}</CardDescription>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <Button asChild><a href={exportUrl("pdf")}><FileDown /> تصدير PDF</a></Button>
            <Button asChild variant="outline"><a href={exportUrl("xlsx")}><FileSpreadsheet /> تصدير Excel</a></Button>
            <Button asChild variant="outline"><a href={exportUrl("print")} target="_blank" rel="noopener"><Printer /> طباعة</a></Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {report.summary.slice(0, 8).map((s) => (
              <div key={s.label} className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-extrabold text-navy">{s.value}</p>
              </div>
            ))}
          </div>
          {chart && chart.length > 0 && (
            <div className="rounded-lg border p-3"><HorizontalBars data={chart} name={filters.type === "departments" ? "عدد الأبحاث" : "عدد المشاركات"} /></div>
          )}
        </CardContent>
        {report.rows.length === 0 ? <EmptyState title="لا توجد بيانات ضمن المعايير المحددة" /> : (
          <Table>
            <TableHeader><TableRow>{report.columns.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {report.rows.map((r, i) => (
                <TableRow key={i}>{r.map((v, j) => <TableCell key={j} className={cn("text-sm", j === 0 && "font-semibold")}>{v}</TableCell>)}</TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
