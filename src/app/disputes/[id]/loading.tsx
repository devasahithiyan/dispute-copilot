import { Card, Skeleton } from "@/components/ui";

// Shown instantly while the dispute loads from PayPal.
export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-24" />
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4">
          <Skeleton className="h-14 w-14 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="ml-auto h-8 w-24" />
          <Skeleton className="h-5 w-32 rounded-full" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="space-y-5 p-6">
          <div className="flex gap-6">
            <Skeleton className="h-32 w-32 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
          <Skeleton className="h-40 w-full" />
        </Card>
        <div className="space-y-4">
          <Card className="space-y-3 p-5">
            <Skeleton className="h-3 w-20" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
            ))}
          </Card>
          <Card className="space-y-3 p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-16 w-full" />
          </Card>
        </div>
      </div>
    </div>
  );
}
