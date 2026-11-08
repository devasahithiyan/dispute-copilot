// The subset of PayPal API response fields this app reads.

export interface Money {
  currency_code: string;
  value: string;
}

export interface Link {
  href: string;
  rel: string;
  method?: string;
}

export interface Address {
  address_line_1?: string;
  address_line_2?: string;
  admin_area_2?: string; // city
  admin_area_1?: string; // state
  postal_code?: string;
  country_code?: string;
}

export interface Tracker {
  id: string; // "<capture_id>-<tracking_number>"
  status: string;
  create_time?: string;
}

export interface CaptureSummary {
  id: string;
  status: string;
  amount: Money;
  create_time?: string;
}

export interface PurchaseUnit {
  reference_id?: string;
  description?: string;
  custom_id?: string;
  amount?: Money;
  items?: { name: string; quantity: string; unit_amount: Money; sku?: string }[];
  shipping?: {
    name?: { full_name?: string };
    address?: Address;
    trackers?: Tracker[];
  };
  payments?: { captures?: CaptureSummary[] };
}

export interface Order {
  id: string;
  status: string;
  create_time?: string;
  purchase_units: PurchaseUnit[];
  payer?: {
    name?: { given_name?: string; surname?: string };
    email_address?: string;
    payer_id?: string;
  };
  links?: Link[];
}

export interface Capture {
  id: string;
  status: string;
  amount: Money;
  create_time?: string;
  links?: Link[];
}

export interface DisputeSummary {
  dispute_id: string;
  create_time: string;
  update_time: string;
  reason: string;
  status: string;
  dispute_state?: string;
  dispute_amount: Money;
  dispute_life_cycle_stage?: string;
  dispute_channel?: string;
}

export interface DisputeList {
  items?: DisputeSummary[];
}

export interface DisputeMessage {
  posted_by: "BUYER" | "SELLER" | string;
  time_posted: string;
  content: string;
}

export interface DisputeEvidence {
  evidence_type?: string;
  notes?: string;
  source?: "SUBMITTED_BY_BUYER" | "SUBMITTED_BY_SELLER" | string;
  date?: string;
  dispute_life_cycle_stage?: string;
}

export interface Dispute extends DisputeSummary {
  seller_response_due_date?: string;
  buyer_response_due_date?: string;
  disputed_transactions?: {
    seller_transaction_id?: string;
    buyer_transaction_id?: string;
    create_time?: string;
    transaction_status?: string;
    gross_amount?: Money;
    invoice_number?: string;
    custom?: string;
    buyer?: { name?: string; email?: string; payer_id?: string };
    seller?: { email?: string; name?: string; merchant_id?: string };
    items?: {
      item_id?: string;
      item_name?: string;
      item_quantity?: string;
      item_description?: string;
      reason?: string;
      item_type?: string;
    }[];
    seller_protection_eligible?: boolean;
    seller_protection_type?: string;
  }[];
  messages?: DisputeMessage[];
  evidences?: DisputeEvidence[];
  offer?: { buyer_requested_amount?: Money };
  extensions?: { merchant_contacted?: boolean; buyer_contacted_time?: string };
  dispute_outcome?: { outcome_code?: string; amount_refunded?: Money };
  links?: Link[];
}
