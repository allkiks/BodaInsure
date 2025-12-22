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
  AlertTriangle,
  HelpCircle,
  FileWarning,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatCurrency } from '@/lib/utils';
import { paymentApi } from '@/services/api/payment.api';
import { walletApi } from '@/services/api/wallet.api';
import { kycApi } from '@/services/api/kyc.api';
import { useAuthStore } from '@/stores/authStore';
import { PAYMENT_AMOUNTS } from '@/config/constants';
import { getErrorMessage } from '@/services/api/client';
import { getMpesaErrorMessage, isMpesaTimeout } from '@/lib/mpesa-errors';

type PaymentType = 'deposit' | 'daily';
type PaymentStep = 'select' | 'confirm' | 'processing' | 'success' | 'failed';

export default function PaymentPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [paymentType, setPaymentType] = useState<PaymentType | null>(null);
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [step, setStep] = useState<PaymentStep>('select');
  const [paymentRequestId, setPaymentRequestId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorResultCode, setErrorResultCode] = useState<string | null>(null); // GAP-008: Track result code for timeout detection
  const [pollingCount, setPollingCount] = useState(0);

  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: walletApi.getWallet,
  });

  // Check KYC status
  const { data: kycStatus, isLoading: isLoadingKyc } = useQuery({
    queryKey: ['kyc', 'status'],
    queryFn: kycApi.getMyStatus,
  });

  const hasDeposit = (walletData?.wallet?.totalDeposited ?? 0) >= PAYMENT_AMOUNTS.INITIAL_DEPOSIT;
  const daysCompleted = walletData?.wallet?.daysCompleted ?? 0;
  const isKycApproved = kycStatus?.overallStatus === 'APPROVED';

  const initiatePayment = useMutation({
    mutationFn: paymentApi.initiateStkPush,
    onSuccess: (data) => {
      setPaymentRequestId(data.paymentRequestId);
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
      // GAP-015: Use UPPERCASE status constants
      if (data.status === 'COMPLETED') {
        setStep('success');
      } else if (data.status === 'FAILED' || data.status === 'CANCELLED') {
        // GAP-007: Use M-Pesa specific error messages when result code is available
        const message = data.resultCode
          ? getMpesaErrorMessage(data.resultCode)
          : data.failureReason ?? data.message;
        setErrorMessage(message ?? 'Payment failed');
        // GAP-008: Track result code for timeout detection
        setErrorResultCode(data.resultCode?.toString() ?? null);
        setStep('failed');
      }
    },
  });

  // Poll for payment status
  useEffect(() => {
    if (step !== 'processing' || !paymentRequestId) return;

    const maxPolls = 30; // 60 seconds (2s interval)
    if (pollingCount >= maxPolls) {
      // GAP-007: Use specific timeout message from M-Pesa mapping
      setErrorMessage(getMpesaErrorMessage('TIMEOUT'));
      // GAP-008: Track timeout for guidance display
      setErrorResultCode('TIMEOUT');
      setStep('failed');
      return;
    }

    const timer = setTimeout(() => {
      checkStatus.mutate(paymentRequestId);
      setPollingCount((prev) => prev + 1);
    }, 2000);

    return () => clearTimeout(timer);
  }, [step, paymentRequestId, pollingCount, checkStatus]);

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
    setPaymentRequestId(null);
    setErrorMessage(null);
    setErrorResultCode(null);
    setPollingCount(0);
  };

  // Step: Select Payment Type
  if (step === 'select') {
    if (isLoadingKyc) {
      return (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      );
    }

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

        {/* KYC Warning if not approved */}
        {!isKycApproved && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <FileWarning className="h-5 w-5" />
                KYC Verification Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-red-600 dark:text-red-300">
                You must complete KYC verification before making payments.
              </p>
              <p className="text-sm text-red-600/80 dark:text-red-300/80">
                Status: <span className="font-medium">{kycStatus?.overallStatus ?? 'Not Started'}</span>
                {' • '}
                Documents: {kycStatus?.completedDocuments ?? 0}/{kycStatus?.totalRequired ?? 6} uploaded
              </p>
              <Button
                variant="outline"
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900"
                onClick={() => navigate('/my/kyc')}
              >
                Complete KYC Verification
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* Deposit Option */}
          <Card
            className={`transition-all ${
              !isKycApproved || hasDeposit
                ? 'cursor-not-allowed opacity-50'
                : 'cursor-pointer ring-2 ring-primary hover:border-primary'
            }`}
            onClick={() => isKycApproved && !hasDeposit && setPaymentType('deposit')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Initial Deposit
              </CardTitle>
              <CardDescription>
                {!isKycApproved
                  ? 'Complete KYC verification first'
                  : hasDeposit
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
            className={`transition-all ${
              !isKycApproved || !hasDeposit || daysCompleted >= PAYMENT_AMOUNTS.DAYS_REQUIRED
                ? 'cursor-not-allowed opacity-50'
                : 'cursor-pointer ring-2 ring-primary hover:border-primary'
            }`}
            onClick={() =>
              isKycApproved &&
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
                {!isKycApproved
                  ? 'Complete KYC verification first'
                  : !hasDeposit
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

  // Step: Processing - with detailed status indicators
  if (step === 'confirm' || step === 'processing') {
    // Determine current phase and messaging based on polling progress
    const getPhaseInfo = () => {
      if (step === 'confirm') {
        return {
          title: 'Initiating Payment',
          description: 'Connecting to M-Pesa...',
          phase: 1,
        };
      }

      const elapsedSeconds = pollingCount * 2;

      if (elapsedSeconds < 10) {
        return {
          title: 'M-Pesa Prompt Sent',
          description: 'Check your phone for the M-Pesa PIN prompt',
          phase: 2,
        };
      } else if (elapsedSeconds < 30) {
        return {
          title: 'Awaiting Your Confirmation',
          description: 'Enter your M-Pesa PIN on your phone to authorize payment',
          phase: 2,
        };
      } else {
        return {
          title: 'Verifying Payment',
          description: 'Please wait while we confirm your payment with M-Pesa...',
          phase: 3,
        };
      }
    };

    const phaseInfo = getPhaseInfo();
    const elapsedSeconds = pollingCount * 2;

    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <CardTitle>{phaseInfo.title}</CardTitle>
            <CardDescription>{phaseInfo.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3].map((stepNum) => (
                <div key={stepNum} className="flex items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                      stepNum < phaseInfo.phase
                        ? 'bg-green-500 text-white'
                        : stepNum === phaseInfo.phase
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {stepNum < phaseInfo.phase ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      stepNum
                    )}
                  </div>
                  {stepNum < 3 && (
                    <div
                      className={`mx-1 h-0.5 w-8 ${
                        stepNum < phaseInfo.phase ? 'bg-green-500' : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Initiate</span>
              <span>Authorize</span>
              <span>Verify</span>
            </div>

            {/* Instructions */}
            <div className="rounded-lg bg-muted p-4 text-left">
              <p className="text-sm font-medium">
                {phaseInfo.phase === 2 ? '📱 Action Required:' : 'Please wait...'}
              </p>
              {phaseInfo.phase === 2 ? (
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>• Check your phone for M-Pesa prompt</li>
                  <li>• Enter your M-Pesa PIN to authorize</li>
                  <li>• Do not close this page</li>
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {phaseInfo.phase === 1
                    ? 'Setting up secure connection...'
                    : 'Confirming payment with Safaricom...'}
                </p>
              )}
            </div>

            {/* Time indicator */}
            {step === 'processing' && (
              <div className="space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min((elapsedSeconds / 60) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {elapsedSeconds < 30
                    ? `Waiting for your authorization...`
                    : `Verifying payment... (${elapsedSeconds}s)`}
                </p>
              </div>
            )}

            <Button variant="outline" onClick={resetPayment}>
              Cancel Payment
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
    const isTimeout = errorResultCode ? isMpesaTimeout(errorResultCode) : false;

    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
              isTimeout ? 'bg-yellow-100 dark:bg-yellow-900' : 'bg-red-100 dark:bg-red-900'
            }`}>
              {isTimeout ? (
                <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              ) : (
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              )}
            </div>
            <CardTitle>{isTimeout ? 'Payment Timeout' : 'Payment Failed'}</CardTitle>
            <CardDescription>
              {errorMessage ?? 'Something went wrong with your payment'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* GAP-008: Show detailed guidance for timeout errors */}
            {isTimeout && (
              <div className="rounded-lg bg-yellow-50 p-4 text-left dark:bg-yellow-900/20">
                <div className="flex items-center gap-2 font-medium text-yellow-800 dark:text-yellow-200">
                  <HelpCircle className="h-4 w-4" />
                  What to do now:
                </div>
                <ol className="ml-6 mt-2 list-decimal space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                  <li>Check your M-Pesa messages for confirmation</li>
                  <li>Check your M-Pesa balance for any deduction</li>
                  <li>If money was deducted, your payment may still be processing</li>
                  <li>If not deducted, you can safely try again</li>
                  <li>Contact support if issues persist</li>
                </ol>
              </div>
            )}

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
