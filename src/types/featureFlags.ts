// AUTO-GENERATED (bootstrap fallback). Replace by running tools/sync_contracts.sh
// Source-of-truth: Agent_Max/api/models/feature_flags.py

export interface FeatureFlagsRolloutInfo {
  websocket_enabled: boolean;
  evidence_validation_enabled: boolean;
  billing_enabled: boolean;
  hmac_enabled: boolean;
}

export interface FeatureFlagsResponse {
  flags: { [key: string]: boolean };
  user_id?: string | null;
  rollout_info: FeatureFlagsRolloutInfo;
}

