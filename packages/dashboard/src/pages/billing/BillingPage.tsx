import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { CheckCircleIcon, StarIcon, CancelIcon } from '../../components/icons.js';
import { useAuth } from '../../auth/index.js';
import { api } from '../../api/index.js';
import type { SubscriptionDTO, CheckoutSessionDTO, ApiError } from '../../api/index.js';
import type { Plan } from '@promptdeploy/shared-types';

// ─── Plan Definitions ───────────────────────────────────────────────────────

interface PlanInfo {
  name: string;
  price: number;
  features: string[];
  highlighted?: boolean;
}

const PLANS: Record<string, PlanInfo> = {
  free: {
    name: 'Free',
    price: 0,
    features: [
      '1 project',
      'Community support',
      'Basic templates',
      '10K tokens / run',
    ],
  },
  pro: {
    name: 'Pro',
    price: 29,
    features: [
      '10 projects',
      'Priority support',
      'All templates',
      '100K tokens / run',
      'Custom domain',
    ],
    highlighted: true,
  },
  team: {
    name: 'Team',
    price: 79,
    features: [
      '50 projects',
      'Dedicated support',
      'All templates',
      '200K tokens / run',
      'Custom domain',
      'Team collaboration',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    price: 199,
    features: [
      'Unlimited projects',
      '24/7 support',
      'All templates',
      '500K tokens / run',
      'Custom domain',
      'SSO & audit logs',
    ],
  },
};

// ─── Status Chip Helper ─────────────────────────────────────────────────────

function subscriptionStatusColor(status: string): 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'active':
      return 'success';
    case 'trialing':
      return 'info';
    case 'past_due':
      return 'warning';
    case 'cancelled':
      return 'error';
    default:
      return 'info';
  }
}

// ─── PayHere Redirect Helper ────────────────────────────────────────────────

function redirectToPayHere(session: CheckoutSessionDTO): void {
  // Build a hidden form and submit it to PayHere (POST redirect)
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = session.actionUrl;

  for (const [key, value] of Object.entries(session.params)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}

// ─── Billing Page ───────────────────────────────────────────────────────────

export function BillingPage() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const fetchedRef = useRef(false);

  const tenantId = user?.tenantId ?? '';

  const fetchSubscription = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await api.subscriptions.list(tenantId);
      // Get the first active or trialing subscription
      const active = result.subscriptions.find(
        (s) => s.status === 'active' || s.status === 'trialing',
      );
      setSubscription(active ?? null);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchSubscription();
    }
  }, [fetchSubscription]);

  const handleSubscribe = async (plan: 'pro' | 'team' | 'enterprise') => {
    if (!tenantId) return;
    try {
      setActionLoading(true);
      setError(null);
      const session = await api.subscriptions.create(tenantId, plan);
      redirectToPayHere(session);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? 'Failed to create subscription');
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!tenantId || !subscription) return;
    try {
      setActionLoading(true);
      setError(null);
      setCancelDialogOpen(false);
      await api.subscriptions.cancel(tenantId, subscription.subscriptionId);
      await fetchSubscription();
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? 'Failed to cancel subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const currentPlan: Plan = subscription?.plan ?? user?.plan ?? 'free';

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h3" gutterBottom>
        Billing
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Manage your subscription and billing preferences.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Current Subscription Banner */}
      {subscription && (
        <Card sx={{ mb: 4, border: '1px solid', borderColor: 'primary.dark' }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="h5" sx={{ mb: 0.5 }}>
                Current Plan: {PLANS[subscription.plan]?.name ?? subscription.plan}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={subscription.status}
                  size="small"
                  color={subscriptionStatusColor(subscription.status)}
                />
                <Typography variant="body2" color="text.secondary">
                  Since {new Date(subscription.createdAt).toLocaleDateString()}
                </Typography>
              </Box>
              {subscription.currentPeriodEnd && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Current period ends{' '}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </Typography>
              )}
            </Box>
            <Button
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={() => setCancelDialogOpen(true)}
              disabled={actionLoading || subscription.status === 'cancelled'}
            >
              Cancel Subscription
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Plan Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 3,
        }}
      >
        {Object.entries(PLANS).map(([planKey, plan]) => {
          const isCurrentPlan = currentPlan === planKey;
          const isUpgrade =
            !isCurrentPlan && planKey !== 'free' && !subscription;
          const canSubscribe =
            planKey !== 'free' && !isCurrentPlan && (subscription?.status !== 'active');

          return (
            <Card
              key={planKey}
              sx={{
                position: 'relative',
                border: '1px solid',
                borderColor: plan.highlighted
                  ? 'primary.main'
                  : isCurrentPlan
                    ? 'primary.dark'
                    : 'divider',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: plan.highlighted
                    ? '0 8px 32px rgba(0,191,165,0.2)'
                    : '0 8px 24px rgba(0,0,0,0.3)',
                },
              }}
            >
              {plan.highlighted && (
                <Chip
                  icon={<StarIcon />}
                  label="Most Popular"
                  color="primary"
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontWeight: 600,
                  }}
                />
              )}

              <CardContent sx={{ pt: plan.highlighted ? 3 : 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                  {plan.name}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 2 }}>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>
                    ${plan.price}
                  </Typography>
                  {plan.price > 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                      /month
                    </Typography>
                  )}
                </Box>

                {isCurrentPlan && (
                  <Chip
                    label="Current Plan"
                    color="primary"
                    size="small"
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                )}

                <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                  {plan.features.map((feature) => (
                    <Box
                      component="li"
                      key={feature}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        py: 0.5,
                      }}
                    >
                      <CheckCircleIcon
                        sx={{ fontSize: 18, color: 'success.main' }}
                      />
                      <Typography variant="body2">{feature}</Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>

              <CardActions sx={{ p: 2, pt: 0 }}>
                {planKey === 'free' ? (
                  <Button fullWidth variant="outlined" disabled>
                    {isCurrentPlan ? 'Current Plan' : 'Free'}
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    variant={plan.highlighted ? 'contained' : 'outlined'}
                    disabled={isCurrentPlan || actionLoading || !canSubscribe}
                    onClick={() =>
                      handleSubscribe(planKey as 'pro' | 'team' | 'enterprise')
                    }
                  >
                    {actionLoading ? (
                      <CircularProgress size={20} />
                    ) : isCurrentPlan ? (
                      'Current Plan'
                    ) : isUpgrade ? (
                      'Subscribe'
                    ) : (
                      'Subscribe'
                    )}
                  </Button>
                )}
              </CardActions>
            </Card>
          );
        })}
      </Box>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle>Cancel Subscription</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to cancel your {PLANS[subscription?.plan ?? '']?.name} plan?
            You will lose access to premium features at the end of your current billing period.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>Keep Plan</Button>
          <Button onClick={handleCancel} color="error" variant="contained">
            Cancel Subscription
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
