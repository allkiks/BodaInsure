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
import {
  getMpesaErrorMessage,
  getMpesaErrorGuidance,
  isMpesaTimeout,
  isMpesaCancelled,
  isMpesaRetryable,
  isMpesaUserError,
} from '@/lib/mpesa-errors';

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
  const [errorResultCode, setErrorResultCode] = useState<string | null>(null);
  const [pollingCount, setPollingCount] = useState(0);
  const [mpesaReceiptNumber, setMpesaReceiptNumber] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      if (data.status === 'COMPLETED') {
        setMpesaReceiptNumber(data.mpesaReceiptNumber ?? null);
        setStep('success');
      } else if (data.status === 'FAILED' || data.status === 'CANCELLED') {
        const message = data.resultCode
          ? getMpesaErrorMessage(data.resultCode)
          : data.failureReason ?? data.message;
        setErrorMessage(message ?? 'Payment failed');
        setErrorResultCode(data.resultCode?.toString() ?? null);
        setStep('failed');
      }
    },
  });

  // Refresh status by querying M-Pesa directly (for missed callbacks)
  const handleRefreshStatus = async () => {
    if (!paymentRequestId) return;

    setIsRefreshing(true);
    try {
      const data = await paymentApi.refreshStatus(paymentRequestId);
      if (data.status === 'COMPLETED') {
        setMpesaReceiptNumber(data.mpesaReceiptNumber ?? null);
        setStep('success');
      } else if (data.status === 'FAILED' || data.status === 'CANCELLED') {
        const message = data.resultCode
          ? getMpesaErrorMessage(data.resultCode)
          : data.failureReason ?? data.message;
        setErrorMessage(message ?? 'Payment failed');
        setErrorResultCode(data.resultCode?.toString() ?? null);
      } else {
        // Still pending
        setErrorMessage('Payment is still being processed. Please wait a moment and try again.');
      }
    } catch {
      setErrorMessage('Unable to check payment status. Please try again or contact support.');
    } finally {
      setIsRefreshing(false);
    }
  };

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
    setMpesaReceiptNumber(null);
    setIsRefreshing(false);
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
            <div className="rounded-lg bg-muted p-4 space-y-2">
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
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Payment Type</span>
                <span className="font-medium capitalize">{paymentType}</span>
              </div>
              {mpesaReceiptNumber && (
                <div className="flex items-center justify-between border-t pt-2 mt-2">
                  <span className="text-sm text-muted-foreground">M-Pesa Receipt</span>
                  <span className="font-mono text-sm font-medium">{mpesaReceiptNumber}</span>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-green-50 p-3 text-left dark:bg-green-900/20">
              <p className="text-sm text-green-700 dark:text-green-300">
                {paymentType === 'deposit'
                  ? '🎉 Your 1-month policy is now active!'
                  : `✅ Daily payment recorded. ${daysCompleted + 1}/${PAYMENT_AMOUNTS.DAYS_REQUIRED} days completed.`}
              </p>
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
    const isCancelled = errorResultCode ? isMpesaCancelled(errorResultCode) : false;
    const isUserError = errorResultCode ? isMpesaUserError(errorResultCode) : false;
    const isRetryable = errorResultCode ? isMpesaRetryable(errorResultCode) : true;
    const guidance = errorResultCode ? getMpesaErrorGuidance(errorResultCode) : null;

    // Determine icon and colors based on error type
    const getErrorStyle = () => {
      if (isTimeout) {
        return {
          bgColor: 'bg-yellow-100 dark:bg-yellow-900',
          icon: <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />,
          title: 'Payment Timeout',
        };
      }
      if (isCancelled) {
        return {
          bgColor: 'bg-gray-100 dark:bg-gray-800',
          icon: <XCircle className="h-8 w-8 text-gray-600 dark:text-gray-400" />,
          title: 'Payment Cancelled',
        };
      }
      return {
        bgColor: 'bg-red-100 dark:bg-red-900',
        icon: <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />,
        title: 'Payment Failed',
      };
    };

    const errorStyle = getErrorStyle();

    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${errorStyle.bgColor}`}>
              {errorStyle.icon}
            </div>
            <CardTitle>{errorStyle.title}</CardTitle>
            <CardDescription>
              {errorMessage ?? 'Something went wrong with your payment'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Show guidance based on error type */}
            {guidance && (
              <div className={`rounded-lg p-4 text-left ${
                isTimeout
                  ? 'bg-yellow-50 dark:bg-yellow-900/20'
                  : isCancelled
                  ? 'bg-gray-50 dark:bg-gray-800/50'
                  : 'bg-red-50 dark:bg-red-900/20'
              }`}>
                <div className={`flex items-center gap-2 font-medium ${
                  isTimeout
                    ? 'text-yellow-800 dark:text-yellow-200'
                    : isCancelled
                    ? 'text-gray-700 dark:text-gray-300'
                    : 'text-red-800 dark:text-red-200'
                }`}>
                  <HelpCircle className="h-4 w-4" />
                  What to do:
                </div>
                <p className={`mt-2 text-sm ${
                  isTimeout
                    ? 'text-yellow-700 dark:text-yellow-300'
                    : isCancelled
                    ? 'text-gray-600 dark:text-gray-400'
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  {guidance}
                </p>
              </div>
            )}

            {/* Detailed timeout instructions */}
            {isTimeout && (
              <div className="rounded-lg bg-blue-50 p-4 text-left dark:bg-blue-900/20">
                <div className="flex items-center gap-2 font-medium text-blue-800 dark:text-blue-200">
                  <Smartphone className="h-4 w-4" />
                  Check your payment status:
                </div>
                <ol className="ml-6 mt-2 list-decimal space-y-1 text-sm text-blue-700 dark:text-blue-300">
                  <li>Check your M-Pesa messages for confirmation</li>
                  <li>Look for any balance deduction</li>
                  <li>Use the button below to verify with M-Pesa</li>
                </ol>
              </div>
            )}

            {/* Check Status button for timeout scenarios */}
            {isTimeout && paymentRequestId && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleRefreshStatus}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking with M-Pesa...
                  </>
                ) : (
                  <>
                    <Phone className="mr-2 h-4 w-4" />
                    Check Payment Status
                  </>
                )}
              </Button>
            )}

            {/* Action buttons */}
            {isRetryable && (
              <Button className="w-full" onClick={resetPayment}>
                {isCancelled ? 'Try Again' : 'Retry Payment'}
              </Button>
            )}

            {!isRetryable && !isUserError && (
              <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-800">
                <p className="text-sm text-muted-foreground">
                  If this issue persists, please contact support.
                </p>
              </div>
            )}

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
