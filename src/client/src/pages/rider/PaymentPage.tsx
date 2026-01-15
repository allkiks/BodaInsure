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
  Clock,
  RefreshCw,
  Bell,
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
type PaymentStep = 'select' | 'confirm' | 'processing' | 'verifying' | 'delayed' | 'success' | 'failed';

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

  // Auto-refresh handler - called when polling times out
  const handleAutoRefresh = async () => {
    if (!paymentRequestId) return;

    setStep('verifying');
    setIsRefreshing(true);

    try {
      const result = await paymentApi.refreshStatus(paymentRequestId);

      if (result.status === 'COMPLETED') {
        setMpesaReceiptNumber(result.mpesaReceiptNumber ?? null);
        setStep('success');
      } else if (result.status === 'FAILED' || result.status === 'CANCELLED') {
        const message = result.resultCode
          ? getMpesaErrorMessage(String(result.resultCode))
          : result.failureReason ?? 'Payment failed';
        setErrorMessage(message);
        setErrorResultCode(result.resultCode?.toString() ?? null);
        setStep('failed');
      } else {
        // Still pending - show delay notification and enqueue for monitoring
        try {
          await paymentApi.enqueueForMonitoring(paymentRequestId);
        } catch {
          // Ignore enqueue errors - non-critical
        }
        setStep('delayed');
      }
    } catch {
      // On error, show delayed state
      setStep('delayed');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Poll for payment status
  useEffect(() => {
    if (step !== 'processing' || !paymentRequestId) return;

    const maxPolls = 30; // 60 seconds (2s interval)
    if (pollingCount >= maxPolls) {
      // Instead of immediately failing, try auto-refresh with M-Pesa
      handleAutoRefresh();
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

  // Step: Processing - with engaging progress indicators
  if (step === 'confirm' || step === 'processing') {
    const elapsedSeconds = pollingCount * 2;

    // Fun rotating messages with emojis - changes every 3 seconds
    const progressMessages = [
      { emoji: '🏍️', text: 'Revving up your coverage...' },
      { emoji: '🛡️', text: 'Activating your protection shield...' },
      { emoji: '🔐', text: 'Securing your journey ahead...' },
      { emoji: '📱', text: 'Connecting with M-Pesa...' },
      { emoji: '💚', text: 'Processing with Safaricom...' },
      { emoji: '🛣️', text: 'Paving your road to safety...' },
      { emoji: '✨', text: 'Almost there, boda hero!' },
      { emoji: '🎯', text: 'Locking in your insurance...' },
      { emoji: '🚀', text: 'Speeding through verification...' },
      { emoji: '🌟', text: 'Making your ride worry-free...' },
      { emoji: '💪', text: 'Building your safety net...' },
      { emoji: '🔄', text: 'Syncing with M-Pesa servers...' },
    ];

    // Get current message based on elapsed time (changes every 3 seconds)
    const messageIndex = Math.floor(elapsedSeconds / 3) % progressMessages.length;
    const currentMessage = progressMessages[messageIndex];

    // Determine current phase and messaging based on polling progress
    const getPhaseInfo = () => {
      if (step === 'confirm') {
        return {
          title: '🚀 Initiating Payment',
          description: 'Connecting to M-Pesa...',
          phase: 1,
          actionRequired: false,
        };
      }

      if (elapsedSeconds < 10) {
        return {
          title: '📲 M-Pesa Prompt Sent!',
          description: 'Check your phone for the M-Pesa PIN prompt',
          phase: 2,
          actionRequired: true,
        };
      } else if (elapsedSeconds < 30) {
        return {
          title: '🔑 Enter Your PIN',
          description: 'Authorize the payment on your phone',
          phase: 2,
          actionRequired: true,
        };
      } else if (elapsedSeconds < 45) {
        return {
          title: '⏳ Verifying Payment',
          description: 'Confirming with Safaricom...',
          phase: 3,
          actionRequired: false,
        };
      } else {
        return {
          title: '🔄 Still Processing',
          description: 'Taking a bit longer than usual...',
          phase: 3,
          actionRequired: false,
        };
      }
    };

    const phaseInfo = getPhaseInfo();

    // Bubble animation classes
    const bubbleColors = [
      'bg-green-400/20',
      'bg-blue-400/20',
      'bg-purple-400/20',
      'bg-yellow-400/20',
      'bg-pink-400/20',
    ];

    return (
      <div className="flex min-h-[50vh] sm:min-h-[60vh] items-center justify-center px-2 sm:px-4">
        <Card className="w-full max-w-md text-center overflow-hidden relative">
          {/* Animated background bubbles - fewer and smaller on mobile */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none hidden sm:block">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`absolute rounded-full ${bubbleColors[i % bubbleColors.length]} animate-pulse`}
                style={{
                  width: `${30 + (i * 10)}px`,
                  height: `${30 + (i * 10)}px`,
                  left: `${10 + (i * 15)}%`,
                  top: `${20 + ((i * 20) % 60)}%`,
                  animationDelay: `${i * 0.3}s`,
                  animationDuration: `${2 + (i * 0.5)}s`,
                }}
              />
            ))}
          </div>
          {/* Simpler bubbles for mobile */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none sm:hidden">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className={`absolute rounded-full ${bubbleColors[i % bubbleColors.length]} animate-pulse`}
                style={{
                  width: `${25 + (i * 8)}px`,
                  height: `${25 + (i * 8)}px`,
                  left: `${15 + (i * 25)}%`,
                  top: `${25 + (i * 20)}%`,
                  animationDelay: `${i * 0.4}s`,
                  animationDuration: `${2.5}s`,
                }}
              />
            ))}
          </div>

          <CardHeader className="relative z-10 px-3 sm:px-6 py-4 sm:py-6">
            {/* Animated emoji icon - smaller on mobile */}
            <div className="mx-auto mb-2 sm:mb-4 flex h-14 w-14 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-500/20 to-blue-500/20 backdrop-blur-sm">
              <span className="text-2xl sm:text-4xl animate-bounce" style={{ animationDuration: '2s' }}>
                {currentMessage.emoji}
              </span>
            </div>
            <CardTitle className="text-base sm:text-xl">{phaseInfo.title}</CardTitle>
            <CardDescription className="text-sm sm:text-base">{phaseInfo.description}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 sm:space-y-5 relative z-10 px-3 sm:px-6 pb-4 sm:pb-6">
            {/* Progress Steps with icons - compact on mobile */}
            <div className="flex items-center justify-center gap-1 sm:gap-2">
              {[
                { num: 1, icon: '📤', label: 'Send' },
                { num: 2, icon: '🔑', label: 'Confirm' },
                { num: 3, icon: '✅', label: 'Done' },
              ].map((s) => (
                <div key={s.num} className="flex items-center">
                  <div
                    className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full text-xs sm:text-sm font-medium transition-all duration-500 ${
                      s.num < phaseInfo.phase
                        ? 'bg-green-500 text-white scale-100'
                        : s.num === phaseInfo.phase
                        ? 'bg-primary text-primary-foreground scale-105 sm:scale-110 ring-2 sm:ring-4 ring-primary/30'
                        : 'bg-muted text-muted-foreground scale-90'
                    }`}
                  >
                    {s.num < phaseInfo.phase ? (
                      <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <span className="text-sm sm:text-base">{s.icon}</span>
                    )}
                  </div>
                  {s.num < 3 && (
                    <div
                      className={`mx-0.5 sm:mx-1 h-0.5 sm:h-1 w-4 sm:w-6 rounded-full transition-all duration-500 ${
                        s.num < phaseInfo.phase ? 'bg-green-500' : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Dynamic status message bubble - responsive */}
            <div className="mx-auto max-w-full sm:max-w-[280px]">
              <div className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-4 transition-all duration-500 ${
                phaseInfo.actionRequired
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-300 dark:border-yellow-700'
                  : 'bg-muted'
              }`}>
                <p className={`text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2 ${
                  phaseInfo.actionRequired ? 'text-yellow-800 dark:text-yellow-200' : ''
                }`}>
                  <span className="text-base sm:text-lg">{currentMessage.emoji}</span>
                  <span className="leading-tight">{currentMessage.text}</span>
                </p>
              </div>
            </div>

            {/* Action required box - compact on mobile */}
            {phaseInfo.actionRequired && (
              <div className="rounded-lg sm:rounded-xl bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 p-2.5 sm:p-4 text-left border border-green-200 dark:border-green-800">
                <p className="text-xs sm:text-sm font-bold text-green-700 dark:text-green-300 flex items-center gap-1.5 sm:gap-2">
                  <Smartphone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  📱 Check Your Phone!
                </p>
                <div className="mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1">
                  <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5 sm:gap-2">
                    <span>👆</span> <span>Look for M-Pesa pop-up</span>
                  </p>
                  <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5 sm:gap-2">
                    <span>🔢</span> <span>Enter your PIN</span>
                  </p>
                  <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5 sm:gap-2">
                    <span>⏰</span> <span>Keep this page open</span>
                  </p>
                </div>
              </div>
            )}

            {/* Animated progress bar */}
            {step === 'processing' && (
              <div className="space-y-1 sm:space-y-2">
                <div className="h-1.5 sm:h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 via-blue-500 to-green-500 transition-all duration-500 animate-pulse"
                    style={{
                      width: `${Math.min((elapsedSeconds / 60) * 100, 95)}%`,
                      backgroundSize: '200% 100%',
                    }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] sm:text-xs text-muted-foreground">
                  <span className="flex items-center gap-0.5 sm:gap-1">
                    <span className="animate-pulse">⏱️</span>
                    {elapsedSeconds}s
                  </span>
                  <span className="flex items-center gap-0.5 sm:gap-1">
                    {elapsedSeconds < 30 ? (
                      <>🟢 Waiting</>
                    ) : elapsedSeconds < 45 ? (
                      <>🔄 Verifying</>
                    ) : (
                      <>⏳ Almost done</>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Fun facts / tips - hidden on very small screens, compact on mobile */}
            {step === 'processing' && elapsedSeconds > 15 && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2 sm:p-3 text-left">
                <p className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 leading-tight">
                  💡 <span className="font-medium">Tip:</span>{' '}
                  {elapsedSeconds < 25
                    ? 'BodaInsure covers 700K+ riders!'
                    : elapsedSeconds < 35
                    ? 'KES 87/day keeps you covered!'
                    : elapsedSeconds < 45
                    ? 'Policy delivered within 6 hours!'
                    : 'M-Pesa is securely processing...'}
                </p>
              </div>
            )}

            <Button variant="outline" onClick={resetPayment} className="w-full text-xs sm:text-sm h-9 sm:h-10">
              ❌ Cancel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step: Verifying - Auto-refresh in progress after timeout
  if (step === 'verifying') {
    return (
      <div className="flex min-h-[50vh] sm:min-h-[60vh] items-center justify-center px-2 sm:px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="px-3 sm:px-6 py-4 sm:py-6">
            <div className="mx-auto mb-2 sm:mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <CardTitle className="text-base sm:text-xl">🔍 Verifying Payment</CardTitle>
            <CardDescription className="text-sm">
              Checking with M-Pesa directly...
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-4 sm:pb-6">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 sm:p-4 text-left">
              <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
                ⏱️ Payment confirmation took longer than expected. We&apos;re checking with M-Pesa to get the latest status.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs sm:text-sm text-muted-foreground">Please wait...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step: Delayed - Payment queued for background monitoring
  if (step === 'delayed') {
    return (
      <div className="flex min-h-[50vh] sm:min-h-[60vh] items-center justify-center px-2 sm:px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="px-3 sm:px-6 py-4 sm:py-6">
            <div className="mx-auto mb-2 sm:mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
              <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            <CardTitle className="text-base sm:text-xl">⏳ Payment Processing Delayed</CardTitle>
            <CardDescription className="text-sm">
              Your payment is taking longer than usual to confirm
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-4 sm:pb-6">
            {/* What's happening */}
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-3 sm:p-4 text-left border border-yellow-200 dark:border-yellow-800">
              <p className="text-xs sm:text-sm font-medium text-yellow-800 dark:text-yellow-200 flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                What&apos;s happening:
              </p>
              <ul className="mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1 text-xs sm:text-sm text-yellow-700 dark:text-yellow-300">
                <li>• M-Pesa confirmation is delayed</li>
                <li>• We&apos;re monitoring automatically</li>
                <li>• You&apos;ll be notified when complete</li>
              </ul>
            </div>

            {/* What you can do */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 sm:p-4 text-left border border-blue-200 dark:border-blue-800">
              <p className="text-xs sm:text-sm font-medium text-blue-800 dark:text-blue-200 flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                What you can do:
              </p>
              <ul className="mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1 text-xs sm:text-sm text-blue-700 dark:text-blue-300">
                <li>• Check M-Pesa messages for confirmation SMS</li>
                <li>• If received, click &quot;Check Status&quot; below</li>
                <li>• If not, wait - we&apos;ll notify you</li>
              </ul>
            </div>

            {/* Check status button */}
            <Button
              variant="secondary"
              className="w-full h-9 sm:h-10 text-xs sm:text-sm"
              onClick={handleRefreshStatus}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                  Checking with M-Pesa...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Check Payment Status
                </>
              )}
            </Button>

            {/* Continue to wallet */}
            <Button
              variant="outline"
              className="w-full h-9 sm:h-10 text-xs sm:text-sm"
              onClick={() => navigate('/my/wallet')}
            >
              📱 Continue to Wallet
            </Button>

            {/* Make new payment */}
            <Button
              variant="ghost"
              className="w-full h-9 sm:h-10 text-xs sm:text-sm text-muted-foreground"
              onClick={resetPayment}
            >
              Start New Payment
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
