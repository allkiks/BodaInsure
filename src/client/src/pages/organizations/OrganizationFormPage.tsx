import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { organizationsApi } from '@/services/api/organizations.api';
import { toast } from '@/hooks/use-toast';
import type { CreateOrganizationRequest, OrganizationType } from '@/types';

const organizationTypes: { value: OrganizationType; label: string }[] = [
  { value: 'UMBRELLA_BODY', label: 'Umbrella Body' },
  { value: 'SACCO', label: 'SACCO' },
  { value: 'ASSOCIATION', label: 'Association' },
  { value: 'STAGE', label: 'Stage' },
];

export default function OrganizationFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEditing = id && id !== 'new';

  const [formData, setFormData] = useState<CreateOrganizationRequest>({
    name: '',
    code: '',
    type: 'SACCO',
    parentId: undefined,
    description: '',
    registrationNumber: '',
    kraPin: '',
    contactPhone: '',
    contactEmail: '',
    address: '',
    countyCode: '',
    subCounty: '',
    ward: '',
    leaderName: '',
    leaderPhone: '',
    secretaryName: '',
    secretaryPhone: '',
    treasurerName: '',
    treasurerPhone: '',
    estimatedMembers: undefined,
    commissionRate: undefined,
  });

  // Fetch existing organization data if editing
  const { data: existingOrg, isLoading: isLoadingOrg } = useQuery({
    queryKey: ['organization', id],
    queryFn: () => organizationsApi.getOrganization(id!),
    enabled: !!isEditing,
  });

  // Fetch umbrella bodies for parent selection
  const { data: umbrellaBodies } = useQuery({
    queryKey: ['umbrella-bodies'],
    queryFn: () => organizationsApi.getUmbrellaBodies(),
  });

  useEffect(() => {
    if (existingOrg) {
      setFormData({
        name: existingOrg.name,
        code: existingOrg.code,
        type: existingOrg.type,
        parentId: existingOrg.parentId,
        description: existingOrg.description ?? '',
        registrationNumber: existingOrg.registrationNumber ?? '',
        kraPin: existingOrg.kraPin ?? '',
        contactPhone: existingOrg.contactPhone ?? '',
        contactEmail: existingOrg.contactEmail ?? '',
        address: existingOrg.address ?? '',
        countyCode: existingOrg.countyCode ?? '',
        subCounty: existingOrg.subCounty ?? '',
        ward: existingOrg.ward ?? '',
        leaderName: existingOrg.leaderName ?? '',
        leaderPhone: existingOrg.leaderPhone ?? '',
        secretaryName: existingOrg.secretaryName ?? '',
        secretaryPhone: existingOrg.secretaryPhone ?? '',
        treasurerName: existingOrg.treasurerName ?? '',
        treasurerPhone: existingOrg.treasurerPhone ?? '',
        estimatedMembers: existingOrg.estimatedMembers,
        commissionRate: existingOrg.commissionRate,
      });
    }
  }, [existingOrg]);

  const createMutation = useMutation({
    mutationFn: (data: CreateOrganizationRequest) =>
      organizationsApi.createOrganization(data),
    onSuccess: (org) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast({ title: 'Organization Created', description: `${org.name} has been created.` });
      navigate(`/organizations/${org.id}`);
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create organization.' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CreateOrganizationRequest) =>
      organizationsApi.updateOrganization(id!, data),
    onSuccess: (org) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization', id] });
      toast({ title: 'Organization Updated', description: `${org.name} has been updated.` });
      navigate(`/organizations/${org.id}`);
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update organization.' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleChange = (field: keyof CreateOrganizationRequest, value: string | number | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isEditing && isLoadingOrg) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/organizations')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? 'Edit Organization' : 'Create Organization'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Update organization details' : 'Add a new organization to the platform'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Core organization details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g., Nairobi Metro SACCO"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                  placeholder="e.g., NMS"
                  maxLength={10}
                  required
                  disabled={isEditing}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">Organization Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => handleChange('type', value as OrganizationType)}
                  disabled={isEditing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizationTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="parentId">Parent Organization</Label>
                <Select
                  value={formData.parentId ?? 'none'}
                  onValueChange={(value) => handleChange('parentId', value === 'none' ? undefined : value)}
                  disabled={formData.type === 'UMBRELLA_BODY'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Parent (Umbrella Body)</SelectItem>
                    {umbrellaBodies?.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name} ({org.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Brief description of the organization"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Registration Details */}
        <Card>
          <CardHeader>
            <CardTitle>Registration Details</CardTitle>
            <CardDescription>Official registration information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="registrationNumber">Registration Number</Label>
                <Input
                  id="registrationNumber"
                  value={formData.registrationNumber}
                  onChange={(e) => handleChange('registrationNumber', e.target.value)}
                  placeholder="e.g., KBA/REG/2020/001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kraPin">KRA PIN</Label>
                <Input
                  id="kraPin"
                  value={formData.kraPin}
                  onChange={(e) => handleChange('kraPin', e.target.value.toUpperCase())}
                  placeholder="e.g., P051234567A"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>How to reach this organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  value={formData.contactPhone}
                  onChange={(e) => handleChange('contactPhone', e.target.value)}
                  placeholder="+254700000001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleChange('contactEmail', e.target.value)}
                  placeholder="info@organization.co.ke"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Physical Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="e.g., Nairobi CBD, Kenya"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="countyCode">County Code</Label>
                <Input
                  id="countyCode"
                  value={formData.countyCode}
                  onChange={(e) => handleChange('countyCode', e.target.value)}
                  placeholder="e.g., 047"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subCounty">Sub-County</Label>
                <Input
                  id="subCounty"
                  value={formData.subCounty}
                  onChange={(e) => handleChange('subCounty', e.target.value)}
                  placeholder="e.g., Westlands"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ward">Ward</Label>
                <Input
                  id="ward"
                  value={formData.ward}
                  onChange={(e) => handleChange('ward', e.target.value)}
                  placeholder="e.g., Parklands"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leadership */}
        <Card>
          <CardHeader>
            <CardTitle>Leadership</CardTitle>
            <CardDescription>Organization officials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leaderName">Leader/Chairman Name</Label>
                <Input
                  id="leaderName"
                  value={formData.leaderName}
                  onChange={(e) => handleChange('leaderName', e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leaderPhone">Leader Phone</Label>
                <Input
                  id="leaderPhone"
                  value={formData.leaderPhone}
                  onChange={(e) => handleChange('leaderPhone', e.target.value)}
                  placeholder="+254700000001"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="secretaryName">Secretary Name</Label>
                <Input
                  id="secretaryName"
                  value={formData.secretaryName}
                  onChange={(e) => handleChange('secretaryName', e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secretaryPhone">Secretary Phone</Label>
                <Input
                  id="secretaryPhone"
                  value={formData.secretaryPhone}
                  onChange={(e) => handleChange('secretaryPhone', e.target.value)}
                  placeholder="+254700000001"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="treasurerName">Treasurer Name</Label>
                <Input
                  id="treasurerName"
                  value={formData.treasurerName}
                  onChange={(e) => handleChange('treasurerName', e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="treasurerPhone">Treasurer Phone</Label>
                <Input
                  id="treasurerPhone"
                  value={formData.treasurerPhone}
                  onChange={(e) => handleChange('treasurerPhone', e.target.value)}
                  placeholder="+254700000001"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Settings</CardTitle>
            <CardDescription>Membership and commission settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="estimatedMembers">Estimated Members</Label>
                <Input
                  id="estimatedMembers"
                  type="number"
                  value={formData.estimatedMembers ?? ''}
                  onChange={(e) => handleChange('estimatedMembers', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="e.g., 5000"
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commissionRate">Commission Rate (%)</Label>
                <Input
                  id="commissionRate"
                  type="number"
                  step="0.1"
                  value={formData.commissionRate ?? ''}
                  onChange={(e) => handleChange('commissionRate', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="e.g., 2.5"
                  min={0}
                  max={100}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/organizations')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditing ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {isEditing ? 'Update Organization' : 'Create Organization'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
