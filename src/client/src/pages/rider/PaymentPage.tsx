import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  Phone,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  Smartphone,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatCurrency } from '@/lib/utils';
import { paymentApi } from '@/services/api/payment.api';
import { walletApi } from '@/services/api/wallet.api';
import { useAuthStore } from '@/stores/authStore';
import { PAYMENT_AMOUNTS } from '@/config/constants';
import { getErrorMessage } from '@/services/api/client';

type PaymentType = 'deposit' | 'daily';
type PaymentStep = 'select' | 'confirm' | 'processing' | 'success' | 'failed';

export default function PaymentPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [paymentType, setPaymentType] = useState<PaymentType | null>(null);
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [step, setStep] = useState<PaymentStep>('select');
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollingCount, setPollingCount] = useState(0);

  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: walletApi.getWallet,
  });

  const hasDeposit = (walletData?.wallet?.totalDeposited ?? 0) >= PAYMENT_AMOUNTS.INITIAL_DEPOSIT;
  const daysCompleted = walletData?.wallet?.daysCompleted ?? 0;

  const initiatePayment = useMutation({
    mutationFn: paymentApi.initiateStkPush,
    onSuccess: (data) => {
      setCheckoutRequestId(data.checkoutRequestId);
      setStep('processing');
      setPollingCount(0);
    },
    onError: (error) => {
      setErrorMessage(getErrorMessage(error));
      setStep('failed');
    },
  });

  const checkStatus = useMutation({
    mutationFn: paymentApi.checkStatus,
    onSuccess: (data) => {
      if (data.status === 'completed') {
        setStep('success');
      } else if (data.status === 'failed' || data.status === 'cancelled') {
        setErrorMessage(data.message);
        setStep('failed');
      }
    },
  });

  // Poll for payment status
  useEffect(() => {
    if (step !== 'processing' || !checkoutRequestId) return;

    const maxPolls = 30; // 60 seconds (2s interval)
    if (pollingCount >= maxPolls) {
      setErrorMessage('Payment timeout. Please check your M-Pesa messages.');
      setStep('failed');
      return;
    }

    const timer = setTimeout(() => {
      checkStatus.mutate(checkoutRequestId);
      setPollingCount((prev) => prev + 1);
    }, 2000);

    return () => clearTimeout(timer);
  }, [step, checkoutRequestId, pollingCount, checkStatus]);

  const handleSubmit = () => {
    if (!paymentType || !phone) return;

    const amount = paymentType === 'deposit'
      ? PAYMENT_AMOUNTS.INITIAL_DEPOSIT
      : PAYMENT_AMOUNTS.DAILY_PAYMENT;

    initiatePayment.mutate({
      amount,
      phone,
      type: paymentType,
    });
    setStep('confirm');
  };

  const resetPayment = () => {
    setPaymentType(null);
    setStep('select');
    setCheckoutRequestId(null);
    setErrorMessage(null);
    setPollingCount(0);
  };

  // Step: Select Payment Type
  if (step === 'select') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/my/wallet')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Make Payment</h1>
            <p className="text-muted-foreground">
              Choose your payment type
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Deposit Option */}
          <Card
            className={`cursor-pointer transition-all hover:border-primary ${
              !hasDeposit ? 'ring-2 ring-primary' : 'opacity-50'
            }`}
            onClick={() => !hasDeposit && setPaymentType('deposit')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Initial Deposit
              </CardTitle>
              <CardDescription>
                {hasDeposit
                  ? 'Already paid'
                  : 'Required to activate your 1-month policy'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatCurrency(PAYMENT_AMOUNTS.INITIAL_DEPOSIT)}
              </div>
              {hasDeposit && (
                <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Completed
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daily Payment Option */}
          <Card
            className={`cursor-pointer transition-all hover:border-primary ${
              hasDeposit && daysCompleted < PAYMENT_AMOUNTS.DAYS_REQUIRED
                ? 'ring-2 ring-primary'
                : hasDeposit
                ? 'opacity-50'
                : ''
            }`}
            onClick={() =>
              hasDeposit &&
              daysCompleted < PAYMENT_AMOUNTS.DAYS_REQUIRED &&
              setPaymentType('daily')
            }
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Daily Payment
              </CardTitle>
              <CardDescription>
                {!hasDeposit
                  ? 'Complete deposit first'
                  : daysCompleted >= PAYMENT_AMOUNTS.DAYS_REQUIRED
                  ? 'All payments completed'
                  : `${daysCompleted}/${PAYMENT_AMOUNTS.DAYS_REQUIRED} days completed`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatCurrency(PAYMENT_AMOUNTS.DAILY_PAYMENT)}
              </div>
              {daysCompleted >= PAYMENT_AMOUNTS.DAYS_REQUIRED && (
                <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  All payments completed
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {paymentType && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
              <CardDescription>
                Enter your M-Pesa phone number
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">M-Pesa Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="0712345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter the phone number registered with M-Pesa
                </p>
              </div>

              <div className="rounded-lg bg-muted p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payment Type</span>
                  <span className="font-medium capitalize">{paymentType}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(
                      paymentType === 'deposit'
                        ? PAYMENT_AMOUNTS.INITIAL_DEPOSIT
                        : PAYMENT_AMOUNTS.DAILY_PAYMENT
                    )}
                  </span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={!phone || phone.length < 10}
              >
                <Smartphone className="mr-2 h-5 w-5" />
                Pay with M-Pesa
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Step: Processing
  if (step === 'confirm' || step === 'processing') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <CardTitle>Processing Payment</CardTitle>
            <CardDescription>
              {step === 'confirm'
                ? 'Sending payment request...'
                : 'Check your phone for the M-Pesa prompt'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-left">
              <p className="text-sm font-medium">Instructions:</p>
              <ol className="mt-2 list-inside list-decimal text-sm text-muted-foreground">
                <li>You will receive an M-Pesa prompt on your phone</li>
                <li>Enter your M-Pesa PIN to confirm payment</li>
                <li>Wait for confirmation</li>
              </ol>
            </div>
            {step === 'processing' && (
              <p className="text-xs text-muted-foreground">
                Waiting for payment confirmation... ({pollingCount * 2}s)
              </p>
            )}
            <Button variant="outline" onClick={resetPayment}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step: Success
  if (step === 'success') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Payment Successful!</CardTitle>
            <CardDescription>
              Your payment has been processed successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Amount Paid</span>
                <span className="font-bold">
                  {formatCurrency(
                    paymentType === 'deposit'
                      ? PAYMENT_AMOUNTS.INITIAL_DEPOSIT
                      : PAYMENT_AMOUNTS.DAILY_PAYMENT
                  )}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={resetPayment}>
                Make Another Payment
              </Button>
              <Button className="flex-1" onClick={() => navigate('/my/wallet')}>
                View Wallet
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step: Failed
  if (step === 'failed') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle>Payment Failed</CardTitle>
            <CardDescription>
              {errorMessage ?? 'Something went wrong with your payment'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" onClick={resetPayment}>
              Try Again
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate('/my/wallet')}>
              Back to Wallet
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <LoadingSpinner />;
}
