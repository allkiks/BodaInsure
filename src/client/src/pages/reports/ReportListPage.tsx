import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Download,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { reportsApi } from '@/services/api/reports.api';
import { toast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/utils';
import type { ReportFormat } from '@/types';

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-800',
};

const statusIcons: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-4 w-4" />,
  PROCESSING: <Loader2 className="h-4 w-4 animate-spin" />,
  COMPLETED: <CheckCircle className="h-4 w-4" />,
  FAILED: <XCircle className="h-4 w-4" />,
  EXPIRED: <Clock className="h-4 w-4" />,
};

const formatLabels: Record<ReportFormat, string> = {
  JSON: 'JSON',
  CSV: 'CSV',
  EXCEL: 'Excel (XLSX)',
  PDF: 'PDF',
};

export default function ReportListPage() {
  const queryClient = useQueryClient();
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [format, setFormat] = useState<ReportFormat>('CSV');

  const { data: definitions } = useQuery({
    queryKey: ['reports', 'definitions'],
    queryFn: reportsApi.getDefinitions,
  });

  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => reportsApi.getGeneratedReports(),
  });

  // Get the selected definition object
  const selectedDefinition = useMemo(() => {
    return definitions?.find((d) => d.id === selectedDefinitionId);
  }, [definitions, selectedDefinitionId]);

  // Get available formats for the selected definition
  const availableFormats = useMemo(() => {
    return selectedDefinition?.availableFormats ?? ['JSON', 'CSV', 'EXCEL', 'PDF'];
  }, [selectedDefinition]);

  // Create a lookup map from definition ID to name
  const definitionNames = useMemo(() => {
    const map: Record<string, string> = {};
    definitions?.forEach((def) => {
      map[def.id] = def.name;
    });
    return map;
  }, [definitions]);

  // Handle definition selection - set default format
  const handleDefinitionChange = (definitionId: string) => {
    setSelectedDefinitionId(definitionId);
    const def = definitions?.find((d) => d.id === definitionId);
    if (def) {
      setFormat(def.defaultFormat);
    }
  };

  const generateMutation = useMutation({
    mutationFn: () =>
      reportsApi.generateReport({
        definitionId: selectedDefinitionId,
        startDate,
        endDate,
        format,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setGenerateDialogOpen(false);
      setSelectedDefinitionId('');
      setStartDate('');
      setEndDate('');
      toast({ title: 'Report Generating', description: 'Your report is being generated.' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed', description: 'Failed to generate report.' });
    },
  });

  const getFileExtension = (format: string): string => {
    const extensions: Record<string, string> = {
      CSV: 'csv',
      JSON: 'json',
      EXCEL: 'xlsx',
      PDF: 'pdf',
    };
    return extensions[format] || 'csv';
  };

  const handleDownload = async (report: { id: string; name: string; format: string }) => {
    try {
      const blob = await reportsApi.downloadReport(report.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = `${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${getFileExtension(report.format)}`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast({ variant: 'destructive', title: 'Failed', description: 'Failed to download report.' });
    }
  };

  const handleGenerate = () => {
    if (!selectedDefinitionId || !startDate || !endDate) {
      toast({ variant: 'destructive', title: 'Required', description: 'Please fill all fields.' });
      return;
    }
    generateMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">
            Generate and download reports
          </p>
        </div>
        <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <FileText className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Generate Report</DialogTitle>
              <DialogDescription>
                Select a report type and date range
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Report Type</Label>
                <Select value={selectedDefinitionId} onValueChange={handleDefinitionChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    {definitions?.map((def) => (
                      <SelectItem key={def.id} value={def.id}>
                        {def.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedDefinition && (
                  <div className="mt-2 rounded-md bg-muted p-3">
                    <div className="flex items-start gap-2">
                      <Info className="mt-0.5 h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {selectedDefinition.description}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {selectedDefinition.availableFormats.map((fmt) => (
                            <Badge
                              key={fmt}
                              variant={fmt === selectedDefinition.defaultFormat ? 'default' : 'outline'}
                              className="text-xs"
                            >
                              {fmt}
                              {fmt === selectedDefinition.defaultFormat && ' (default)'}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={format} onValueChange={(v: ReportFormat) => setFormat(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFormats.map((fmt) => (
                      <SelectItem key={fmt} value={fmt}>
                        {formatLabels[fmt as ReportFormat] || fmt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
                {generateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Available Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Available Report Types</CardTitle>
          <CardDescription>
            Reports that can be generated on demand
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {definitions?.map((def) => (
              <div
                key={def.id}
                className="rounded-lg border p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">{def.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{def.description}</p>
                <div className="flex flex-wrap gap-1">
                  {def.availableFormats.map((fmt) => (
                    <Badge
                      key={fmt}
                      variant={fmt === def.defaultFormat ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {fmt}
                    </Badge>
                  ))}
                </div>
              </div>
            )) ?? (
              <p className="text-muted-foreground col-span-3 text-center py-4">
                No report types available
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generated Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Generated Reports
          </CardTitle>
          <CardDescription>
            Previously generated reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : reports?.data && reports.data.length > 0 ? (
            <div className="space-y-2">
              {reports.data.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {report.name || definitionNames[report.definitionId] || 'Report'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {report.startDate} - {report.endDate}
                        {report.recordCount !== undefined && (
                          <span className="ml-2">({report.recordCount} records)</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(report.createdAt)}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {report.format}
                      </Badge>
                    </div>
                    <Badge className={statusColors[report.status]}>
                      <span className="mr-1">{statusIcons[report.status]}</span>
                      {report.status}
                    </Badge>
                    {report.status === 'COMPLETED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(report)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No reports generated yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
