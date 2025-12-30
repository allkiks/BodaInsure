import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CashFlowLineItem, CashFlowPeriod } from '@/types';
import { cn } from '@/lib/utils';

interface CashFlowReportViewProps {
  reportTitle: string;
  organizationName: string;
  currentPeriod: CashFlowPeriod;
  priorPeriod: CashFlowPeriod;
  lineItems: CashFlowLineItem[];
}

/**
 * Format a number as currency (KES)
 * Negative numbers shown in parentheses per accounting convention
 */
function formatCurrency(value: number | null): string {
  if (value === null) return '';

  const absValue = Math.abs(value);
  const formatted = new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absValue);

  return value < 0 ? `(${formatted})` : formatted;
}

/**
 * Format date range as readable string
 */
function formatDateRange(period: CashFlowPeriod): string {
  const start = new Date(period.startDate);
  const end = new Date(period.endDate);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-KE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return `${formatDate(start)} - ${formatDate(end)}`;
}

/**
 * CashFlowReportView Component
 *
 * Renders a Statement of Cash Flows in a professional accounting format
 * with proper indentation, bold headers/totals, and three-column layout.
 */
export function CashFlowReportView({
  reportTitle,
  organizationName,
  currentPeriod,
  priorPeriod,
  lineItems,
}: CashFlowReportViewProps) {
  // Filter out empty spacer rows for cleaner rendering
  const visibleItems = useMemo(() => {
    return lineItems.filter((item) => item.label !== '');
  }, [lineItems]);

  return (
    <Card className="w-full">
      <CardHeader className="text-center border-b bg-muted/30 print:bg-transparent">
        <div className="space-y-1">
          <CardTitle className="text-2xl font-bold text-primary">
            {reportTitle}
          </CardTitle>
          <p className="text-lg font-medium text-foreground">
            {organizationName}
          </p>
          <p className="text-sm text-muted-foreground">
            For the period: {formatDateRange(currentPeriod)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_150px_150px_150px] border-b bg-muted/50 font-semibold text-sm">
          <div className="p-3 border-r" />
          <div className="p-3 text-right border-r">
            <div className="font-semibold">Current Period</div>
            <div className="text-xs text-muted-foreground font-normal">
              {formatDateRange(currentPeriod)}
            </div>
          </div>
          <div className="p-3 text-right border-r">
            <div className="font-semibold">Prior Period</div>
            <div className="text-xs text-muted-foreground font-normal">
              {formatDateRange(priorPeriod)}
            </div>
          </div>
          <div className="p-3 text-right">
            <div className="font-semibold">Increase</div>
            <div className="text-xs text-muted-foreground font-normal">
              (Decrease)
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="divide-y">
          {visibleItems.map((item, index) => (
            <CashFlowLineItemRow key={item.id || index} item={item} />
          ))}
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/30 p-4 text-center text-xs text-muted-foreground print:bg-transparent">
          <p>All amounts in Kenya Shillings (KES)</p>
          <p className="mt-1">
            Generated on {new Date().toLocaleDateString('en-KE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Individual line item row component
 */
function CashFlowLineItemRow({ item }: { item: CashFlowLineItem }) {
  const isHeader = item.currentPeriod === null && item.priorPeriod === null;
  const showTopBorder = item.isTotal;

  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_150px_150px_150px] text-sm hover:bg-muted/30 transition-colors',
        showTopBorder && 'border-t-2 border-foreground/20',
        item.isBold && 'font-semibold',
        isHeader && 'bg-muted/20',
      )}
    >
      {/* Label with indentation */}
      <div
        className={cn(
          'p-3 border-r',
          item.indent === 1 && 'pl-8',
          item.indent === 2 && 'pl-12',
        )}
      >
        {item.label}
      </div>

      {/* Current Period */}
      <div
        className={cn(
          'p-3 text-right border-r tabular-nums',
          item.currentPeriod !== null && item.currentPeriod < 0 && 'text-red-600',
        )}
      >
        {formatCurrency(item.currentPeriod)}
      </div>

      {/* Prior Period */}
      <div
        className={cn(
          'p-3 text-right border-r tabular-nums',
          item.priorPeriod !== null && item.priorPeriod < 0 && 'text-red-600',
        )}
      >
        {formatCurrency(item.priorPeriod)}
      </div>

      {/* Variance */}
      <div
        className={cn(
          'p-3 text-right tabular-nums',
          item.variance !== null && item.variance < 0 && 'text-red-600',
          item.variance !== null && item.variance > 0 && 'text-green-600',
        )}
      >
        {item.variance !== null && (
          <span className="flex items-center justify-end gap-1">
            {formatCurrency(item.variance)}
            {item.variance !== 0 && !item.isTotal && (
              <VarianceIndicator value={item.variance} />
            )}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Small visual indicator for positive/negative variance
 */
function VarianceIndicator({ value }: { value: number }) {
  if (value === 0) return null;

  return (
    <Badge
      variant={value > 0 ? 'default' : 'destructive'}
      className="ml-1 h-4 px-1 text-[10px] leading-none"
    >
      {value > 0 ? '+' : '-'}
    </Badge>
  );
}

export default CashFlowReportView;
