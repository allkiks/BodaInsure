import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authApi } from '@/services/api/auth.api';
import { getErrorMessage } from '@/services/api/client';
import { toast } from '@/hooks/use-toast';

const loginSchema = z.object({
  phone: z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(12, 'Phone number must not exceed 12 digits')
    .regex(/^(07|01|254)\d+$/, 'Enter a valid Kenyan phone number'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phone: '',
    },
  });

  const onSubmit = async (data: LoginForm) => {
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

      const response = await authApi.login({ phone });

      // Store session ID and navigate to OTP verification
      sessionStorage.setItem('otp-session', JSON.stringify({
        sessionId: response.sessionId,
        phone: data.phone,
        expiresAt: response.expiresAt,
      }));

      toast({
        title: 'OTP Sent',
        description: 'A verification code has been sent to your phone.',
      });

      navigate('/verify-otp');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
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
          <CardTitle className="text-2xl">BodaInsure Admin</CardTitle>
          <CardDescription>
            Enter your phone number to sign in
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
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send OTP
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
