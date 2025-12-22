import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, Loader2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { authApi } from '@/services/api/auth.api';
import { organizationsApi } from '@/services/api/organizations.api';
import { getErrorMessage } from '@/services/api/client';
import { toast } from '@/hooks/use-toast';
import type { Organization } from '@/types';

const registerSchema = z.object({
  phone: z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(12, 'Phone number must not exceed 12 digits')
    .regex(/^(07|01|254)\d+$/, 'Enter a valid Kenyan phone number'),
  organizationId: z.string().min(1, 'Please select your SACCO'),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms of service',
  }),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [saccos, setSaccos] = useState<Organization[]>([]);
  const [isLoadingSaccos, setIsLoadingSaccos] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      phone: '',
      organizationId: '',
      termsAccepted: false,
    },
  });

  const termsAccepted = watch('termsAccepted');
  const selectedOrgId = watch('organizationId');

  // Fetch SACCOs on mount
  useEffect(() => {
    const fetchSaccos = async () => {
      try {
        const data = await organizationsApi.getSaccos();
        setSaccos(data);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Failed to load organizations',
          description: getErrorMessage(error),
        });
      } finally {
        setIsLoadingSaccos(false);
      }
    };

    fetchSaccos();
  }, []);

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      // Normalize phone number to +254 format
      let phone = data.phone;
      if (phone.startsWith('07') || phone.startsWith('01')) {
        phone = '254' + phone.slice(1);
      }
      if (!phone.startsWith('+')) {
        phone = '+' + phone;
      }

      const response = await authApi.register({
        phone,
        organizationId: data.organizationId,
        termsAccepted: data.termsAccepted,
      });

      if (response.status === 'SUCCESS') {
        // Store session info and navigate to OTP verification
        sessionStorage.setItem(
          'otp-session',
          JSON.stringify({
            userId: response.userId,
            phone: data.phone,
            isRegistration: true,
          })
        );

        toast({
          title: 'OTP Sent',
          description: response.message,
        });

        navigate('/verify-otp');
      } else if (response.status === 'DUPLICATE') {
        toast({
          variant: 'destructive',
          title: 'Already Registered',
          description: 'This phone number is already registered. Please login instead.',
        });
        navigate('/login');
      } else {
        toast({
          variant: 'destructive',
          title: 'Registration Failed',
          description: response.message,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: getErrorMessage(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Join BodaInsure</CardTitle>
          <CardDescription>
            Register to get affordable motorcycle insurance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="0712345678"
                {...register('phone')}
                disabled={isLoading}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizationId">
                <Building2 className="mr-1 inline h-4 w-4" />
                Select Your SACCO
              </Label>
              <Select
                value={selectedOrgId}
                onValueChange={(value) => setValue('organizationId', value)}
                disabled={isLoading || isLoadingSaccos}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingSaccos ? 'Loading SACCOs...' : 'Select your SACCO'} />
                </SelectTrigger>
                <SelectContent>
                  {saccos.map((sacco) => (
                    <SelectItem key={sacco.id} value={sacco.id}>
                      {sacco.name} ({sacco.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.organizationId && (
                <p className="text-sm text-destructive">{errors.organizationId.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Select the SACCO you belong to. If your SACCO is not listed, contact your SACCO administrator.
              </p>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="termsAccepted"
                checked={termsAccepted}
                onCheckedChange={(checked) => setValue('termsAccepted', checked === true)}
                disabled={isLoading}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="termsAccepted"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I accept the terms of service
                </Label>
                <p className="text-xs text-muted-foreground">
                  By registering, you agree to our{' '}
                  <a href="/terms" className="text-primary hover:underline">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>
            </div>
            {errors.termsAccepted && (
              <p className="text-sm text-destructive">{errors.termsAccepted.message}</p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading || isLoadingSaccos}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Register
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
          <p className="text-sm text-muted-foreground">
            Admin user?{' '}
            <Link to="/admin/login" className="text-primary hover:underline">
              Sign in with username
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
