import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authApi } from '@/services/api/auth.api';
import { getErrorMessage } from '@/services/api/client';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/hooks/use-toast';
import { maskPhone } from '@/lib/utils';

const otpSchema = z.object({
  otp: z
    .string()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d+$/, 'OTP must contain only numbers'),
});

type OtpForm = z.infer<typeof otpSchema>;

interface OtpSession {
  sessionId: string;
  phone: string;
  expiresAt: string;
}

export default function OtpVerifyPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<OtpSession | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp: '',
    },
  });

  useEffect(() => {
    const storedSession = sessionStorage.getItem('otp-session');
    if (!storedSession) {
      navigate('/login');
      return;
    }

    try {
      const parsed = JSON.parse(storedSession) as OtpSession;
      const expiresAt = new Date(parsed.expiresAt);
      if (expiresAt < new Date()) {
        sessionStorage.removeItem('otp-session');
        navigate('/login');
        return;
      }
      setSession(parsed);
    } catch {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const onSubmit = async (data: OtpForm) => {
    if (!session) return;

    setIsLoading(true);
    try {
      const response = await authApi.verifyOtp({
        sessionId: session.sessionId,
        otp: data.otp,
      });

      // Clear session storage
      sessionStorage.removeItem('otp-session');

      // Login with the received token
      login(response.user, response.token);

      toast({
        title: 'Welcome',
        description: 'You have successfully signed in.',
      });

      navigate('/dashboard');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Verification Failed',
        description: getErrorMessage(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!session || resendCooldown > 0) return;

    try {
      let phone = session.phone;
      if (phone.startsWith('07') || phone.startsWith('01')) {
        phone = '254' + phone.slice(1);
      }
      if (!phone.startsWith('+')) {
        phone = '+' + phone;
      }

      const response = await authApi.login({ phone });

      setSession({
        ...session,
        sessionId: response.sessionId,
        expiresAt: response.expiresAt,
      });

      sessionStorage.setItem('otp-session', JSON.stringify({
        sessionId: response.sessionId,
        phone: session.phone,
        expiresAt: response.expiresAt,
      }));

      setResendCooldown(60); // 60 second cooldown

      toast({
        title: 'OTP Resent',
        description: 'A new verification code has been sent to your phone.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Resend Failed',
        description: getErrorMessage(error),
      });
    }
  };

  const handleBack = () => {
    sessionStorage.removeItem('otp-session');
    navigate('/login');
  };

  if (!session) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Verify OTP</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to {maskPhone(session.phone)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                type="text"
                placeholder="000000"
                maxLength={6}
                className="text-center text-2xl tracking-widest"
                {...register('otp')}
                disabled={isLoading}
              />
              {errors.otp && (
                <p className="text-sm text-destructive">{errors.otp.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify
            </Button>
          </form>

          <div className="mt-4 flex flex-col items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResendOtp}
              disabled={resendCooldown > 0}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
            </Button>
            <Button variant="link" size="sm" onClick={handleBack}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
