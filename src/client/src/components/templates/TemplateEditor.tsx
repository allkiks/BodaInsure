import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, Plus, X, Eye, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { templatesApi } from '@/services/api/templates.api';
import type {
  NotificationTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  NotificationChannel,
  NotificationType,
  TemplateStatus,
} from '@/types';

interface TemplateEditorProps {
  template: NotificationTemplate | null;
  onClose: () => void;
  onSave: () => void;
}

const NOTIFICATION_CHANNELS: NotificationChannel[] = ['SMS', 'EMAIL', 'WHATSAPP', 'PUSH'];
const NOTIFICATION_TYPES: NotificationType[] = [
  'OTP',
  'PAYMENT_RECEIVED',
  'PAYMENT_REMINDER',
  'POLICY_ISSUED',
  'POLICY_EXPIRING',
  'POLICY_EXPIRED',
  'POLICY_LAPSED',
  'KYC_APPROVED',
  'KYC_REJECTED',
  'WELCOME',
  'ACCOUNT_SUSPENDED',
  'GENERAL',
];
const TEMPLATE_STATUSES: TemplateStatus[] = ['ACTIVE', 'DRAFT', 'ARCHIVED'];

// Common variables that can be used in templates
const COMMON_VARIABLES = [
  { name: 'firstName', description: "User's first name" },
  { name: 'lastName', description: "User's last name" },
  { name: 'fullName', description: "User's full name" },
  { name: 'phone', description: "User's phone number" },
  { name: 'email', description: "User's email address" },
  { name: 'amount', description: 'Payment amount' },
  { name: 'balance', description: 'Wallet balance' },
  { name: 'policyNumber', description: 'Policy number' },
  { name: 'startDate', description: 'Policy start date' },
  { name: 'endDate', description: 'Policy end date' },
  { name: 'daysRemaining', description: 'Days until policy expiry' },
  { name: 'otp', description: 'OTP code' },
  { name: 'otpExpiry', description: 'OTP expiry time' },
  { name: 'organizationName', description: "User's organization name" },
  { name: 'daysCompleted', description: 'Number of daily payments made' },
  { name: 'daysRequired', description: 'Total days required' },
  { name: 'reason', description: 'Rejection/suspension reason' },
];

// Default HTML template structure for emails
const DEFAULT_EMAIL_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">BodaInsure</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                Dear {{firstName}},
              </p>
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                <!-- Main content goes here -->
                {{content}}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px; color: #666666; font-size: 12px;">
                This is an automated message from BodaInsure. Please do not reply to this email.
              </p>
              <p style="margin: 0; color: #666666; font-size: 12px;">
                &copy; 2024 BodaInsure. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export function TemplateEditor({ template, onClose, onSave }: TemplateEditorProps) {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    channel: 'SMS' as NotificationChannel,
    notificationType: 'GENERAL' as NotificationType,
    subject: '',
    body: '',
    htmlBody: '',
    previewText: '',
    variables: [] as string[],
    status: 'DRAFT' as TemplateStatus,
    isDefault: false,
  });

  const [newVariable, setNewVariable] = useState('');
  const [activeTab, setActiveTab] = useState('edit');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { toast } = useToast();
  const isEditing = !!template;

  useEffect(() => {
    if (template) {
      setFormData({
        code: template.code,
        name: template.name,
        description: template.description || '',
        channel: template.channel,
        notificationType: template.notificationType,
        subject: template.subject || '',
        body: template.body,
        htmlBody: template.htmlBody || '',
        previewText: template.previewText || '',
        variables: template.variables || [],
        status: template.status,
        isDefault: template.isDefault,
      });
    }
  }, [template]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateTemplateRequest) => templatesApi.create(data),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Template created successfully.' });
      onSave();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create template.',
        variant: 'destructive',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTemplateRequest }) =>
      templatesApi.update(id, data),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Template updated successfully.' });
      onSave();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update template.',
        variant: 'destructive',
      });
    },
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.code.trim()) {
      newErrors.code = 'Code is required';
    } else if (!/^[a-z][a-z0-9_]*$/.test(formData.code)) {
      newErrors.code = 'Code must start with a letter and contain only lowercase letters, numbers, and underscores';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.body.trim()) {
      newErrors.body = 'Body is required';
    }

    if (formData.channel === 'EMAIL' && !formData.subject.trim()) {
      newErrors.subject = 'Subject is required for email templates';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const data = {
      code: formData.code,
      name: formData.name,
      description: formData.description || undefined,
      channel: formData.channel,
      notificationType: formData.notificationType,
      subject: formData.subject || undefined,
      body: formData.body,
      htmlBody: formData.channel === 'EMAIL' ? formData.htmlBody || undefined : undefined,
      previewText: formData.channel === 'EMAIL' ? formData.previewText || undefined : undefined,
      variables: formData.variables,
      status: formData.status,
      isDefault: formData.isDefault,
    };

    if (isEditing && template) {
      const { code: _code, channel: _channel, notificationType: _type, ...updateData } = data;
      updateMutation.mutate({ id: template.id, data: updateData });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleAddVariable = () => {
    const trimmed = newVariable.trim();
    if (trimmed && !formData.variables.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        variables: [...prev.variables, trimmed],
      }));
      setNewVariable('');
    }
  };

  const handleRemoveVariable = (variable: string) => {
    setFormData((prev) => ({
      ...prev,
      variables: prev.variables.filter((v) => v !== variable),
    }));
  };

  const handleInsertVariable = (variable: string) => {
    const insertion = `{{${variable}}}`;
    setFormData((prev) => ({
      ...prev,
      body: prev.body + insertion,
    }));
  };

  const handleGenerateHtmlTemplate = () => {
    setFormData((prev) => ({
      ...prev,
      htmlBody: DEFAULT_EMAIL_HTML,
    }));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isEmailChannel = formData.channel === 'EMAIL';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="edit">
            <Code className="mr-2 h-4 w-4" />
            Edit
          </TabsTrigger>
          <TabsTrigger value="variables">Variables</TabsTrigger>
          {isEmailChannel && (
            <TabsTrigger value="preview">
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="edit" className="space-y-4 mt-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, code: e.target.value.toLowerCase() }))
                }
                placeholder="e.g., sms_payment_received"
                disabled={isEditing}
                className={`font-mono ${errors.code ? 'border-destructive' : ''}`}
              />
              {errors.code && (
                <p className="text-xs text-destructive">{errors.code}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Payment Received SMS"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Brief description of when this template is used"
            />
          </div>

          {/* Channel, Type, Status */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select
                value={formData.channel}
                onValueChange={(value: NotificationChannel) =>
                  setFormData((prev) => ({ ...prev, channel: value }))
                }
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_CHANNELS.map((channel) => (
                    <SelectItem key={channel} value={channel}>
                      {channel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notification Type</Label>
              <Select
                value={formData.notificationType}
                onValueChange={(value: NotificationType) =>
                  setFormData((prev) => ({ ...prev, notificationType: value }))
                }
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: TemplateStatus) =>
                  setFormData((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Email-specific fields */}
          {isEmailChannel && (
            <>
              <div className="space-y-2">
                <Label htmlFor="subject">
                  Subject <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, subject: e.target.value }))
                  }
                  placeholder="e.g., Your payment of {{amount}} has been received"
                  className={errors.subject ? 'border-destructive' : ''}
                />
                {errors.subject && (
                  <p className="text-xs text-destructive">{errors.subject}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="previewText">Preview Text</Label>
                <Input
                  id="previewText"
                  value={formData.previewText}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, previewText: e.target.value }))
                  }
                  placeholder="Shown in email client preview (optional)"
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.previewText.length}/200 characters
                </p>
              </div>
            </>
          )}

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">
              Body (Plain Text) <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="body"
              value={formData.body}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, body: e.target.value }))
              }
              placeholder={
                isEmailChannel
                  ? 'Plain text version of the email...'
                  : 'Enter message template with {{variables}}...'
              }
              rows={isEmailChannel ? 4 : 6}
              className={`font-mono text-sm ${errors.body ? 'border-destructive' : ''}`}
            />
            {errors.body && (
              <p className="text-xs text-destructive">{errors.body}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Use {'{{variableName}}'} for dynamic content
            </p>
          </div>

          {/* HTML Body for Email */}
          {isEmailChannel && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="htmlBody">HTML Body</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateHtmlTemplate}
                >
                  Generate Template
                </Button>
              </div>
              <Textarea
                id="htmlBody"
                value={formData.htmlBody}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, htmlBody: e.target.value }))
                }
                placeholder="HTML email template (optional but recommended)"
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Professional HTML template for email clients. Leave empty to use plain text.
              </p>
            </div>
          )}

          {/* Default toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="isDefault"
              checked={formData.isDefault}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, isDefault: checked }))
              }
            />
            <Label htmlFor="isDefault">Set as default template for this type</Label>
          </div>
        </TabsContent>

        <TabsContent value="variables" className="space-y-4 mt-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Variables are placeholders like {'{{firstName}}'} that get replaced with actual
              values when sending notifications.
            </AlertDescription>
          </Alert>

          {/* Current variables */}
          <div className="space-y-2">
            <Label>Current Variables</Label>
            <div className="flex flex-wrap gap-2">
              {formData.variables.length === 0 ? (
                <p className="text-sm text-muted-foreground">No variables defined</p>
              ) : (
                formData.variables.map((variable) => (
                  <Badge key={variable} variant="secondary" className="text-sm">
                    {`{{${variable}}}`}
                    <button
                      type="button"
                      onClick={() => handleRemoveVariable(variable)}
                      className="ml-1 rounded-full hover:bg-destructive/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </div>

          {/* Add variable */}
          <div className="space-y-2">
            <Label>Add Variable</Label>
            <div className="flex gap-2">
              <Input
                value={newVariable}
                onChange={(e) => setNewVariable(e.target.value)}
                placeholder="e.g., amount"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddVariable();
                  }
                }}
              />
              <Button type="button" onClick={handleAddVariable}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Common variables */}
          <div className="space-y-2">
            <Label>Common Variables</Label>
            <p className="text-sm text-muted-foreground">
              Click to add to your template body
            </p>
            <div className="grid grid-cols-2 gap-2">
              {COMMON_VARIABLES.map(({ name, description }) => (
                <Button
                  key={name}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    if (!formData.variables.includes(name)) {
                      setFormData((prev) => ({
                        ...prev,
                        variables: [...prev.variables, name],
                      }));
                    }
                    handleInsertVariable(name);
                  }}
                >
                  <code className="mr-2 text-xs">{`{{${name}}}`}</code>
                  <span className="text-xs text-muted-foreground truncate">
                    {description}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </TabsContent>

        {isEmailChannel && (
          <TabsContent value="preview" className="mt-4">
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This is a preview of your HTML email. Variables are shown as placeholders.
                </AlertDescription>
              </Alert>

              {formData.htmlBody ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 border-b">
                    <p className="text-sm font-medium">Subject: {formData.subject || '(No subject)'}</p>
                    {formData.previewText && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Preview: {formData.previewText}
                      </p>
                    )}
                  </div>
                  <div
                    className="bg-white"
                    style={{ minHeight: '400px' }}
                    dangerouslySetInnerHTML={{ __html: formData.htmlBody }}
                  />
                </div>
              ) : (
                <div className="border rounded-lg p-8 text-center">
                  <p className="text-muted-foreground">
                    No HTML template defined. Click "Generate Template" to create one.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={handleGenerateHtmlTemplate}
                  >
                    Generate Template
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : isEditing ? 'Update Template' : 'Create Template'}
        </Button>
      </div>
    </form>
  );
}
