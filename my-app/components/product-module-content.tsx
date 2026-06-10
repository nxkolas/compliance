import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type ProductModuleCard = {
  title: string;
  description?: string;
  items: string[];
};

export type ProductModuleMetric = {
  label: string;
  value: string;
};

type ProductModuleContentProps = {
  title: string;
  description: string;
  metrics?: ProductModuleMetric[];
  cards: ProductModuleCard[];
};

export function ProductModuleContent({
  title,
  description,
  metrics = [],
  cards,
}: ProductModuleContentProps) {
  return (
    <section className="flex w-full flex-col gap-8">
      <PageHeader title={title} subtitle={description} />

      {metrics.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-md border bg-card px-4 py-3"
            >
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <p className="mt-1 text-xl font-semibold">{metric.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map((card) => (
          <Card key={card.title} className="rounded-lg shadow-sm">
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
              {card.description && (
                <CardDescription>{card.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                {card.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/50" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
