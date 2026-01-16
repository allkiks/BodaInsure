import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Search,
  Plus,
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  Filter,
  MoreVertical,
  Copy,
  Pencil,
  Trash2,
  Eye,
  Database,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { templatesApi } from '@/services/api/templates.api';
import { TemplateEditor } from '@/components/templates/TemplateEditor';
import type {
  NotificationTemplate,
  NotificationChannel,
  TemplateStatus,
} from '@/types';

const channelIcons: Record<NotificationChannel, React.ReactNode> = {
  SMS: <MessageSquare className="h-4 w-4" />,
  EMAIL: <Mail className="h-4 w-4" />,
  WHATSAPP: <Smartphone className="h-4 w-4" />,
  PUSH: <Bell className="h-4 w-4" />,
};

const channelColors: Record<NotificationChannel, string> = {
  SMS: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  EMAIL: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  WHATSAPP: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  PUSH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
};

const statusVariants: Record<TemplateStatus, 'default' | 'secondary' | 'outline'> = {
  ACTIVE: 'default',
  DRAFT: 'secondary',
  ARCHIVED: 'outline',
};

export default function TemplatesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [duplicateCode, setDuplicateCode] = useState('');
  const [previewContent, setPreviewContent] = useState<{
    subject?: string;
    body: string;
    htmlBody?: string;
  } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch templates
  const { data, isLoading, error } = useQuery({
    queryKey: ['templates', searchQuery, channelFilter, statusFilter, page],
    queryFn: () =>
      templatesApi.list({
        search: searchQuery || undefined,
        channel: channelFilter !== 'all' ? (channelFilter as NotificationChannel) : undefined,
        status: statusFilter !== 'all' ? (statusFilter as TemplateStatus) : undefined,
        page,
        limit: 20,
      }),
  });

  // Seed defaults mutation
  const seedMutation = useMutation({
    mutationFn: templatesApi.seedDefaults,
    onSuccess: (count) => {
      toast({
        title: 'Templates Seeded',
        description: `${count} default templates have been created.`,
      });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to seed default templates.',
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: templatesApi.delete,
    onSuccess: () => {
      toast({
        title: 'Template Archived',
        description: 'The template has been archived successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsDeleteOpen(false);
      setSelectedTemplate(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to archive template.',
        variant: 'destructive',
      });
    },
  });

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: ({ id, code }: { id: string; code: string }) =>
      templatesApi.duplicate(id, code),
    onSuccess: () => {
      toast({
        title: 'Template Duplicated',
        description: 'The template has been duplicated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsDuplicateOpen(false);
      setSelectedTemplate(null);
      setDuplicateCode('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to duplicate template. Code may already exist.',
        variant: 'destructive',
      });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleNewTemplate = () => {
    setSelectedTemplate(null);
    setIsEditorOpen(true);
  };

  const handleEditTemplate = (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    setIsEditorOpen(true);
  };

  const handlePreviewTemplate = async (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    // Create sample variables for preview
    const sampleVariables: Record<string, string | number> = {};
    template.variables.forEach((v) => {
      if (v.toLowerCase().includes('name')) {
        sampleVariables[v] = 'John Doe';
      } else if (v.toLowerCase().includes('phone')) {
        sampleVariables[v] = '+254712345678';
      } else if (v.toLowerCase().includes('amount')) {
        sampleVariables[v] = 'KES 87';
      } else if (v.toLowerCase().includes('date')) {
        sampleVariables[v] = new Date().toLocaleDateString();
      } else if (v.toLowerCase().includes('number') || v.toLowerCase().includes('policy')) {
        sampleVariables[v] = 'POL-2024-00001';
      } else if (v.toLowerCase().includes('otp') || v.toLowerCase().includes('code')) {
        sampleVariables[v] = '123456';
      } else if (v.toLowerCase().includes('balance')) {
        sampleVariables[v] = 'KES 500';
      } else if (v.toLowerCase().includes('days')) {
        sampleVariables[v] = '15';
      } else {
        sampleVariables[v] = `[${v}]`;
      }
    });

    try {
      const preview = await templatesApi.preview(template.id, sampleVariables);
      setPreviewContent(preview);
      setIsPreviewOpen(true);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to generate preview.',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicateTemplate = (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    setDuplicateCode(`${template.code}_copy`);
    setIsDuplicateOpen(true);
  };

  const handleDeleteTemplate = (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    setIsDeleteOpen(true);
  };

  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setSelectedTemplate(null);
  };

  const handleEditorSave = () => {
    queryClient.invalidateQueries({ queryKey: ['templates'] });
    setIsEditorOpen(false);
    setSelectedTemplate(null);
  };

  const templates = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notification Templates</h1>
          <p className="text-muted-foreground">
            Manage SMS and Email notification templates
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            <Database className="mr-2 h-4 w-4" />
            Seed Defaults
          </Button>
          <Button onClick={handleNewTemplate}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="PUSH">Push</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit">Search</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground">Failed to load templates</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && templates.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No Templates Found</h3>
            <p className="mt-2 text-center text-muted-foreground">
              {searchQuery || channelFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first template or seed defaults to get started'}
            </p>
            {!searchQuery && channelFilter === 'all' && statusFilter === 'all' && (
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => seedMutation.mutate()}>
                  <Database className="mr-2 h-4 w-4" />
                  Seed Defaults
                </Button>
                <Button onClick={handleNewTemplate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && templates.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {templates.length} of {data?.meta.total ?? 0} templates
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md p-1.5 ${channelColors[template.channel]}`}>
                        {channelIcons[template.channel]}
                      </span>
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <p className="text-xs text-muted-foreground font-mono">
                          {template.code}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePreviewTemplate(template)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditTemplate(template)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateTemplate(template)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteTemplate(template)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariants[template.status]}>
                        {template.status}
                      </Badge>
                      <Badge variant="outline">
                        {template.notificationType.replace(/_/g, ' ')}
                      </Badge>
                      {template.isDefault && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {template.description || template.body.substring(0, 100)}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>v{template.version}</span>
                      <span>{formatDate(template.updatedAt)}</span>
                    </div>
                    {template.variables.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {template.variables.slice(0, 3).map((v) => (
                          <span
                            key={v}
                            className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono"
                          >
                            {`{{${v}}}`}
                          </span>
                        ))}
                        {template.variables.length > 3 && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                            +{template.variables.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {data && data.meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {data.meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
                disabled={page === data.meta.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Template Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate
                ? 'Update the template content and settings'
                : 'Create a new notification template'}
            </DialogDescription>
          </DialogHeader>
          <TemplateEditor
            template={selectedTemplate}
            onClose={handleEditorClose}
            onSave={handleEditorSave}
          />
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>
              Preview with sample data - {selectedTemplate?.name}
            </DialogDescription>
          </DialogHeader>
          {previewContent && (
            <div className="space-y-4">
              {previewContent.subject && (
                <div>
                  <label className="text-sm font-medium">Subject</label>
                  <p className="mt-1 rounded bg-muted p-3">{previewContent.subject}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Body (Plain Text)</label>
                <p className="mt-1 rounded bg-muted p-3 whitespace-pre-wrap">
                  {previewContent.body}
                </p>
              </div>
              {previewContent.htmlBody && (
                <div>
                  <label className="text-sm font-medium">HTML Preview</label>
                  <div
                    className="mt-1 rounded border bg-white p-3"
                    dangerouslySetInnerHTML={{ __html: previewContent.htmlBody }}
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={isDuplicateOpen} onOpenChange={setIsDuplicateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Template</DialogTitle>
            <DialogDescription>
              Enter a unique code for the new template copy
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">New Template Code</label>
              <Input
                value={duplicateCode}
                onChange={(e) => setDuplicateCode(e.target.value)}
                placeholder="e.g., sms_welcome_copy"
                className="mt-1 font-mono"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Use lowercase letters, numbers, and underscores only
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDuplicateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  selectedTemplate &&
                  duplicateMutation.mutate({ id: selectedTemplate.id, code: duplicateCode })
                }
                disabled={!duplicateCode || duplicateMutation.isPending}
              >
                {duplicateMutation.isPending ? 'Duplicating...' : 'Duplicate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive the template "{selectedTemplate?.name}". Archived templates
              can be restored later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedTemplate && deleteMutation.mutate(selectedTemplate.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Archiving...' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
