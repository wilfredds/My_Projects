/**
 * Database types, kept in step with `supabase/schema.sql` by hand.
 *
 * Once the project exists you can generate this instead, which is harder to get
 * wrong:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
 *
 * Handing this type to `createClient<Database>()` is what makes the client
 * typed end to end: a select on a column that does not exist stops being a
 * runtime surprise and starts being a red squiggle.
 */

export type ReservationStatus = "pending" | "confirmed" | "seated" | "cancelled";
export type StaffRole = "crew" | "host" | "owner";

export type Reservation = {
  id: string;
  name: string;
  contact: string;
  reserve_date: string;
  reserve_time: string;
  party_size: number;
  package: string | null;
  notes: string | null;
  status: ReservationStatus;
  created_at: string;
  updated_at: string;
};

/**
 * What staff actually read. Same shape as `Reservation` minus nothing, but the
 * `contact` you get back depends on who is asking: host and owner see the
 * digits, crew sees "•••• 4567". `contact_visible` says which one you got, so
 * the UI never has to guess whether it is looking at a real number.
 */
export type StaffReservation = Omit<Reservation, "contact"> & {
  contact: string;
  contact_visible: boolean;
};

export type Profile = {
  id: string;
  full_name: string | null;
  role: StaffRole;
  created_at: string;
};

export type ReservationEvent = {
  id: number;
  reservation_id: string | null;
  actor_id: string | null;
  actor_role: StaffRole | null;
  action: "created" | "status_changed" | "edited" | "deleted";
  from_status: ReservationStatus | null;
  to_status: ReservationStatus | null;
  created_at: string;
};

/** The insert shape for a public booking request. */
export type ReservationInsert = Pick<
  Reservation,
  "name" | "contact" | "reserve_date" | "reserve_time" | "party_size"
> & {
  package?: string | null;
  notes?: string | null;
  /* `status` is deliberately absent. The RLS policy only accepts an insert
     where status = 'pending', and the column defaults to exactly that — so the
     one safe value is the one you get by not sending it. Making it
     un-settable here means the type system enforces the same rule the database
     does, one step earlier. */
};

/** No writable columns — the shape supabase-js wants for an append-only table. */
type NoWrites = Record<string, never>;

/**
 * supabase-js requires a `Relationships` array on every table and view — it is
 * what the generated types use to typecheck embedded joins like
 * `.select("*, profiles(*)")`. We declare no joins, so it is empty everywhere,
 * but the key has to be present: omitting it makes each table resolve to
 * `never`, which surfaces as the thoroughly unhelpful "'name' does not exist in
 * type 'never[]'".
 */
type NoJoins = [];

export type Database = {
  public: {
    Tables: {
      reservations: {
        Row: Reservation;
        Insert: ReservationInsert;
        Update: Partial<Omit<Reservation, "id" | "created_at">>;
        Relationships: NoJoins;
      };
      profiles: {
        Row: Profile;
        Insert: Profile;
        Update: Partial<Profile>;
        Relationships: NoJoins;
      };
      reservation_events: {
        Row: ReservationEvent;
        /* The audit trail is written only by a database trigger. No policy
           permits a write from any client, so the types say so too. */
        Insert: NoWrites;
        Update: NoWrites;
        Relationships: NoJoins;
      };
      rate_limits: {
        Row: { bucket: string; count: number; window_start: string };
        Insert: NoWrites;
        Update: NoWrites;
        Relationships: NoJoins;
      };
    };
    Views: {
      staff_reservations: {
        Row: StaffReservation;
        Relationships: NoJoins;
      };
    };
    Functions: {
      staff_role: {
        Args: Record<PropertyKey, never>;
        Returns: StaffRole | null;
      };
      check_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
    };
    /* supabase-js checks for these two keys even when they are empty. Leaving
       them out makes every table resolve to `never`, which shows up as the
       baffling "'name' does not exist in type 'never[]'". */
    Enums: Record<PropertyKey, never>;
    CompositeTypes: Record<PropertyKey, never>;
  };
};
