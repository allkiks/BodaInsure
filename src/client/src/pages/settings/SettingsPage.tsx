import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Settings,
  Bell,
  Database,
  Server,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatDateTime } from '@/lib/utils';

// Mock settings API
const settingsApi = {
  getSystemInfo: async () => ({
    version: '1.0.0',
    environment: 'production',
    nodeVersion: '20.10.0',
    uptime: '7 days, 12 hours',
    lastDeployment: new Date().toISOString(),
  }),
  getAuditLogs: async (page = 1) => ({
    data: [
      { id: '1', action: 'USER_LOGIN', actor: 'admin@example.com', timestamp: new Date().toISOString(), details: 'Login from 192.168.1.1' },
      { id: '2', action: 'KYC_APPROVED', actor: 'admin@example.com', timestamp: new Date().toISOString(), details: 'Approved document for user 0712***678' },
      { id: '3', action: 'REPORT_GENERATED', actor: 'admin@example.com', timestamp: new Date().toISOString(), details: 'Generated enrollment report' },
    ],
    meta: { page, totalPages: 5, total: 50 },
  }),
  getFeatureFlags: async () => ([
    { id: 'ussd_enabled', name: 'USSD Channel', enabled: true, description: 'Enable USSD access for riders' },
    { id: 'sms_enabled', name: 'SMS Notifications', enabled: true, description: 'Send SMS notifications to users' },
    { id: 'whatsapp_enabled', name: 'WhatsApp Notifications', enabled: true, description: 'Send WhatsApp messages for policy delivery' },
    { id: 'bulk_payments', name: 'Bulk Payments', enabled: false, description: 'Allow SACCO bulk payment processing' },
  ]),
};

const actionColors: Record<string, string> = {
  USER_LOGIN: 'bg-blue-100 text-blue-800',
  KYC_APPROVED: 'bg-green-100 text-green-800',
  KYC_REJECTED: 'bg-red-100 text-red-800',
  REPORT_GENERATED: 'bg-purple-100 text-purple-800',
  SETTINGS_CHANGED: 'bg-yellow-100 text-yellow-800',
};

export default function SettingsPage() {
  const [auditPage, setAuditPage] = useState(1);

  const { data: systemInfo, isLoading: systemLoading } = useQuery({
    queryKey: ['settings', 'system'],
    queryFn: settingsApi.getSystemInfo,
  });

  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ['settings', 'audit', auditPage],
    queryFn: () => settingsApi.getAuditLogs(auditPage),
  });

  const { data: featureFlags } = useQuery({
    queryKey: ['settings', 'features'],
    queryFn: settingsApi.getFeatureFlags,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          System configuration and audit logs
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  System Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {systemLoading ? (
                  <LoadingSpinner />
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Version</span>
                      <Badge variant="outline">{systemInfo?.version}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Environment</span>
                      <Badge className="bg-green-100 text-green-800">
                        {systemInfo?.environment}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Node.js</span>
                      <span>{systemInfo?.nodeVersion}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Uptime</span>
                      <span>{systemInfo?.uptime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Deploy</span>
                      <span>{systemInfo?.lastDeployment ? formatDateTime(systemInfo.lastDeployment) : '-'}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Connection</span>
                    <Badge className="bg-green-100 text-green-800">Healthy</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pool Size</span>
                    <span>10 / 20</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Response Time</span>
                    <span>12ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure how notifications are sent to users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send SMS for OTP and payment reminders
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>WhatsApp Policy Delivery</Label>
                  <p className="text-sm text-muted-foreground">
                    Send policy documents via WhatsApp
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send email for admin reports
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Feature Flags
              </CardTitle>
              <CardDescription>
                Enable or disable platform features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {featureFlags?.map((flag) => (
                <div key={flag.id} className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{flag.name}</Label>
                    <p className="text-sm text-muted-foreground">{flag.description}</p>
                  </div>
                  <Switch defaultChecked={flag.enabled} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Audit Log
              </CardTitle>
              <CardDescription>
                Track all system actions and changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <LoadingSpinner />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {auditLogs?.data.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between rounded-lg border p-4"
                      >
                        <div className="flex items-center gap-4">
                          <Badge className={actionColors[log.action] ?? 'bg-gray-100 text-gray-800'}>
                            {log.action.replace(/_/g, ' ')}
                          </Badge>
                          <div>
                            <p className="font-medium">{log.details}</p>
                            <p className="text-sm text-muted-foreground">{log.actor}</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(log.timestamp)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {auditLogs && auditLogs.meta.totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Page {auditLogs.meta.page} of {auditLogs.meta.totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                          disabled={auditPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAuditPage((p) => p + 1)}
                          disabled={auditPage >= auditLogs.meta.totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
