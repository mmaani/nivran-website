--
-- PostgreSQL database dump
--

\restrict D3HOE8u9jPz13WvGxsXzMxsf3enVB44QWrD3qSaInsbRIgYhLDY4GAmkf1mRpkn

-- Dumped from database version 17.7 (bdd1736)
-- Dumped by pg_dump version 17.8 (Debian 17.8-0+deb13u1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: order_status; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.order_status AS ENUM (
    'PENDING_COD_CONFIRM',
    'PENDING_PAYMENT',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELED',
    'PAYMENT_FAILED',
    'RETURN_REQUESTED',
    'RETURNED',
    'REFUNDED'
);


ALTER TYPE public.order_status OWNER TO neondb_owner;

--
-- Name: payment_provider; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.payment_provider AS ENUM (
    'PAYTABS',
    'COD'
);


ALTER TYPE public.payment_provider OWNER TO neondb_owner;

--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.payment_status AS ENUM (
    'UNPAID',
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED',
    'COD_DUE',
    'COD_PAID'
);


ALTER TYPE public.payment_status OWNER TO neondb_owner;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: batches; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.batches (
    id bigint NOT NULL,
    variant_id bigint NOT NULL,
    lot_code text NOT NULL,
    mfg_date date,
    expiry_date date,
    qty_total integer DEFAULT 0 NOT NULL,
    qty_available integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT batches_qty_available_check CHECK ((qty_available >= 0)),
    CONSTRAINT batches_qty_total_check CHECK ((qty_total >= 0))
);


ALTER TABLE public.batches OWNER TO neondb_owner;

--
-- Name: batches_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.batches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.batches_id_seq OWNER TO neondb_owner;

--
-- Name: batches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.batches_id_seq OWNED BY public.batches.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.categories (
    key text NOT NULL,
    name_en text NOT NULL,
    name_ar text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_promoted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.categories OWNER TO neondb_owner;

--
-- Name: contact_submissions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.contact_submissions (
    id bigint NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    message text NOT NULL,
    locale text DEFAULT 'en'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.contact_submissions OWNER TO neondb_owner;

--
-- Name: contact_submissions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.contact_submissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contact_submissions_id_seq OWNER TO neondb_owner;

--
-- Name: contact_submissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.contact_submissions_id_seq OWNED BY public.contact_submissions.id;


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.coupons (
    id bigint NOT NULL,
    code text NOT NULL,
    type text NOT NULL,
    value numeric(10,2) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    max_uses integer,
    used_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT coupons_type_check CHECK ((type = ANY (ARRAY['PERCENT'::text, 'FIXED'::text])))
);


ALTER TABLE public.coupons OWNER TO neondb_owner;

--
-- Name: coupons_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.coupons_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.coupons_id_seq OWNER TO neondb_owner;

--
-- Name: coupons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.coupons_id_seq OWNED BY public.coupons.id;


--
-- Name: customer_password_reset_tokens; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customer_password_reset_tokens (
    id bigint NOT NULL,
    customer_id bigint NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone
);


ALTER TABLE public.customer_password_reset_tokens OWNER TO neondb_owner;

--
-- Name: customer_password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.customer_password_reset_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_password_reset_tokens_id_seq OWNER TO neondb_owner;

--
-- Name: customer_password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.customer_password_reset_tokens_id_seq OWNED BY public.customer_password_reset_tokens.id;


--
-- Name: customer_sessions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customer_sessions (
    id bigint NOT NULL,
    customer_id bigint NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    token_hash text
);


ALTER TABLE public.customer_sessions OWNER TO neondb_owner;

--
-- Name: customer_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.customer_sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_sessions_id_seq OWNER TO neondb_owner;

--
-- Name: customer_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.customer_sessions_id_seq OWNED BY public.customer_sessions.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customers (
    id bigint NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    first_name text,
    last_name text,
    phone text,
    locale text DEFAULT 'en'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    full_name text
);


ALTER TABLE public.customers OWNER TO neondb_owner;

--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.customers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customers_id_seq OWNER TO neondb_owner;

--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.inventory (
    variant_id bigint NOT NULL,
    on_hand integer DEFAULT 0 NOT NULL,
    reserved integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_on_hand_check CHECK ((on_hand >= 0)),
    CONSTRAINT inventory_reserved_check CHECK ((reserved >= 0))
);


ALTER TABLE public.inventory OWNER TO neondb_owner;

--
-- Name: newsletter_subscribers; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.newsletter_subscribers (
    id bigint NOT NULL,
    email text NOT NULL,
    locale text DEFAULT 'en'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.newsletter_subscribers OWNER TO neondb_owner;

--
-- Name: newsletter_subscribers_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.newsletter_subscribers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.newsletter_subscribers_id_seq OWNER TO neondb_owner;

--
-- Name: newsletter_subscribers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.newsletter_subscribers_id_seq OWNED BY public.newsletter_subscribers.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.order_items (
    id bigint NOT NULL,
    order_id bigint NOT NULL,
    variant_id bigint NOT NULL,
    qty integer NOT NULL,
    unit_price_jod numeric(10,2) NOT NULL,
    lot_code text,
    line_total_jod numeric(10,2) NOT NULL,
    CONSTRAINT order_items_qty_check CHECK ((qty > 0))
);


ALTER TABLE public.order_items OWNER TO neondb_owner;

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.order_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_items_id_seq OWNER TO neondb_owner;

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.orders (
    id bigint NOT NULL,
    cart_id text NOT NULL,
    status text DEFAULT 'PENDING_PAYMENT'::text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'JOD'::text NOT NULL,
    locale text DEFAULT 'en'::text NOT NULL,
    customer_email text,
    customer_name text,
    paytabs_tran_ref text,
    paytabs_response_status text,
    paytabs_response_message text,
    paytabs_payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    customer jsonb,
    shipping jsonb,
    payment_method text DEFAULT 'PAYTABS'::text NOT NULL,
    customer_id bigint,
    paytabs_last_payload text,
    paytabs_last_signature text
);


ALTER TABLE public.orders OWNER TO neondb_owner;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO neondb_owner;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.password_reset_tokens (
    id bigint NOT NULL,
    staff_user_id bigint NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.password_reset_tokens OWNER TO neondb_owner;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.password_reset_tokens_id_seq OWNER TO neondb_owner;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.payments (
    id bigint NOT NULL,
    order_id bigint NOT NULL,
    provider public.payment_provider NOT NULL,
    status public.payment_status NOT NULL,
    amount_jod numeric(10,2) NOT NULL,
    paytabs_cart_id text,
    paytabs_tran_ref text,
    paytabs_tran_id text,
    signature text,
    callback_raw jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payments OWNER TO neondb_owner;

--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payments_id_seq OWNER TO neondb_owner;

--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: paytabs_callbacks; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.paytabs_callbacks (
    id bigint NOT NULL,
    received_at timestamp with time zone DEFAULT now(),
    payload jsonb,
    signature text,
    verified boolean DEFAULT false NOT NULL,
    cart_id text,
    tran_ref text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    signature_header text,
    signature_computed text,
    signature_valid boolean DEFAULT false NOT NULL,
    raw_body text,
    payload_json jsonb
);


ALTER TABLE public.paytabs_callbacks OWNER TO neondb_owner;

--
-- Name: paytabs_callbacks_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.paytabs_callbacks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.paytabs_callbacks_id_seq OWNER TO neondb_owner;

--
-- Name: paytabs_callbacks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.paytabs_callbacks_id_seq OWNED BY public.paytabs_callbacks.id;


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.product_images (
    id bigint NOT NULL,
    product_id bigint NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    filename text,
    content_type text NOT NULL,
    bytes bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.product_images OWNER TO neondb_owner;

--
-- Name: product_images_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.product_images_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_images_id_seq OWNER TO neondb_owner;

--
-- Name: product_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.product_images_id_seq OWNED BY public.product_images.id;


--
-- Name: product_media; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.product_media (
    id bigint NOT NULL,
    product_id bigint NOT NULL,
    url text NOT NULL,
    alt_en text,
    alt_ar text,
    sort integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.product_media OWNER TO neondb_owner;

--
-- Name: product_media_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.product_media_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_media_id_seq OWNER TO neondb_owner;

--
-- Name: product_media_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.product_media_id_seq OWNED BY public.product_media.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.products (
    id bigint NOT NULL,
    slug_en text NOT NULL,
    slug_ar text NOT NULL,
    name_en text NOT NULL,
    name_ar text NOT NULL,
    tagline_en text DEFAULT 'Wear the calm.'::text NOT NULL,
    tagline_ar text DEFAULT 'ارتدِ الهدوء'::text NOT NULL,
    story_en text,
    story_ar text,
    notes_json jsonb,
    concentration text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    description_en text,
    description_ar text,
    price_jod numeric(10,2),
    compare_at_price_jod numeric(10,2),
    inventory_qty integer DEFAULT 0 NOT NULL,
    slug text NOT NULL,
    category_key text DEFAULT 'perfume'::text
);


ALTER TABLE public.products OWNER TO neondb_owner;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.products_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO neondb_owner;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.promotions (
    id bigint NOT NULL,
    code text NOT NULL,
    title_en text NOT NULL,
    title_ar text NOT NULL,
    discount_type text NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    usage_limit integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT promotions_discount_type_check CHECK ((discount_type = ANY (ARRAY['PERCENT'::text, 'FIXED'::text])))
);


ALTER TABLE public.promotions OWNER TO neondb_owner;

--
-- Name: promotions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.promotions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.promotions_id_seq OWNER TO neondb_owner;

--
-- Name: promotions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.promotions_id_seq OWNED BY public.promotions.id;


--
-- Name: shipments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.shipments (
    id bigint NOT NULL,
    order_id bigint NOT NULL,
    courier_name text,
    tracking_number text,
    shipped_at timestamp with time zone,
    delivered_at timestamp with time zone,
    cod_amount_jod numeric(10,2),
    notes text
);


ALTER TABLE public.shipments OWNER TO neondb_owner;

--
-- Name: shipments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.shipments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shipments_id_seq OWNER TO neondb_owner;

--
-- Name: shipments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.shipments_id_seq OWNED BY public.shipments.id;


--
-- Name: staff_users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.staff_users (
    id bigint NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    full_name text,
    role text DEFAULT 'staff'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.staff_users OWNER TO neondb_owner;

--
-- Name: staff_users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.staff_users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.staff_users_id_seq OWNER TO neondb_owner;

--
-- Name: staff_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.staff_users_id_seq OWNED BY public.staff_users.id;


--
-- Name: variants; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.variants (
    id bigint NOT NULL,
    product_id bigint NOT NULL,
    sku text NOT NULL,
    size_ml integer DEFAULT 100 NOT NULL,
    price_jod numeric(10,2) NOT NULL,
    active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.variants OWNER TO neondb_owner;

--
-- Name: variants_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.variants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.variants_id_seq OWNER TO neondb_owner;

--
-- Name: variants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.variants_id_seq OWNED BY public.variants.id;


--
-- Name: batches id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batches ALTER COLUMN id SET DEFAULT nextval('public.batches_id_seq'::regclass);


--
-- Name: contact_submissions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.contact_submissions ALTER COLUMN id SET DEFAULT nextval('public.contact_submissions_id_seq'::regclass);


--
-- Name: coupons id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.coupons ALTER COLUMN id SET DEFAULT nextval('public.coupons_id_seq'::regclass);


--
-- Name: customer_password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.customer_password_reset_tokens_id_seq'::regclass);


--
-- Name: customer_sessions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_sessions ALTER COLUMN id SET DEFAULT nextval('public.customer_sessions_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: newsletter_subscribers id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.newsletter_subscribers ALTER COLUMN id SET DEFAULT nextval('public.newsletter_subscribers_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: paytabs_callbacks id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.paytabs_callbacks ALTER COLUMN id SET DEFAULT nextval('public.paytabs_callbacks_id_seq'::regclass);


--
-- Name: product_images id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.product_images ALTER COLUMN id SET DEFAULT nextval('public.product_images_id_seq'::regclass);


--
-- Name: product_media id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.product_media ALTER COLUMN id SET DEFAULT nextval('public.product_media_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: promotions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.promotions ALTER COLUMN id SET DEFAULT nextval('public.promotions_id_seq'::regclass);


--
-- Name: shipments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.shipments ALTER COLUMN id SET DEFAULT nextval('public.shipments_id_seq'::regclass);


--
-- Name: staff_users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff_users ALTER COLUMN id SET DEFAULT nextval('public.staff_users_id_seq'::regclass);


--
-- Name: variants id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.variants ALTER COLUMN id SET DEFAULT nextval('public.variants_id_seq'::regclass);


--
-- Name: batches batches_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_pkey PRIMARY KEY (id);


--
-- Name: batches batches_variant_id_lot_code_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_variant_id_lot_code_key UNIQUE (variant_id, lot_code);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (key);


--
-- Name: contact_submissions contact_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.contact_submissions
    ADD CONSTRAINT contact_submissions_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: customer_password_reset_tokens customer_password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_password_reset_tokens
    ADD CONSTRAINT customer_password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: customer_password_reset_tokens customer_password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_password_reset_tokens
    ADD CONSTRAINT customer_password_reset_tokens_token_key UNIQUE (token);


--
-- Name: customer_sessions customer_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_sessions
    ADD CONSTRAINT customer_sessions_pkey PRIMARY KEY (id);


--
-- Name: customer_sessions customer_sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_sessions
    ADD CONSTRAINT customer_sessions_token_key UNIQUE (token);


--
-- Name: customers customers_email_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_email_key UNIQUE (email);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (variant_id);


--
-- Name: newsletter_subscribers newsletter_subscribers_email_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_email_key UNIQUE (email);


--
-- Name: newsletter_subscribers newsletter_subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_cart_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_cart_id_key UNIQUE (cart_id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: payments payments_paytabs_tran_ref_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_paytabs_tran_ref_key UNIQUE (paytabs_tran_ref);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: paytabs_callbacks paytabs_callbacks_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.paytabs_callbacks
    ADD CONSTRAINT paytabs_callbacks_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_media product_media_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.product_media
    ADD CONSTRAINT product_media_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_slug_ar_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_ar_key UNIQUE (slug_ar);


--
-- Name: products products_slug_en_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_en_key UNIQUE (slug_en);


--
-- Name: promotions promotions_code_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_code_key UNIQUE (code);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: shipments shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_pkey PRIMARY KEY (id);


--
-- Name: staff_users staff_users_email_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff_users
    ADD CONSTRAINT staff_users_email_key UNIQUE (email);


--
-- Name: staff_users staff_users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff_users
    ADD CONSTRAINT staff_users_pkey PRIMARY KEY (id);


--
-- Name: variants variants_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.variants
    ADD CONSTRAINT variants_pkey PRIMARY KEY (id);


--
-- Name: variants variants_sku_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.variants
    ADD CONSTRAINT variants_sku_key UNIQUE (sku);


--
-- Name: idx_contact_created_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_contact_created_at ON public.contact_submissions USING btree (created_at DESC);


--
-- Name: idx_customer_reset_tokens_customer_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_customer_reset_tokens_customer_id ON public.customer_password_reset_tokens USING btree (customer_id);


--
-- Name: idx_customer_reset_tokens_token; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_customer_reset_tokens_token ON public.customer_password_reset_tokens USING btree (token);


--
-- Name: idx_customer_sessions_customer; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_customer_sessions_customer ON public.customer_sessions USING btree (customer_id);


--
-- Name: idx_customer_sessions_customer_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_customer_sessions_customer_id ON public.customer_sessions USING btree (customer_id);


--
-- Name: idx_customer_sessions_expires; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_customer_sessions_expires ON public.customer_sessions USING btree (expires_at);


--
-- Name: idx_customer_sessions_token; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_customer_sessions_token ON public.customer_sessions USING btree (token);


--
-- Name: idx_customers_active; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_customers_active ON public.customers USING btree (is_active);


--
-- Name: idx_newsletter_created_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_newsletter_created_at ON public.newsletter_subscribers USING btree (created_at DESC);


--
-- Name: idx_newsletter_email_unique; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX idx_newsletter_email_unique ON public.newsletter_subscribers USING btree (email);


--
-- Name: idx_orders_cart_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_orders_cart_id ON public.orders USING btree (cart_id);


--
-- Name: idx_orders_created; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_orders_created ON public.orders USING btree (created_at);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_password_reset_tokens_expires; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_password_reset_tokens_expires ON public.password_reset_tokens USING btree (expires_at);


--
-- Name: idx_password_reset_tokens_staff; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_password_reset_tokens_staff ON public.password_reset_tokens USING btree (staff_user_id);


--
-- Name: idx_paytabs_callbacks_cart_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_paytabs_callbacks_cart_id ON public.paytabs_callbacks USING btree (cart_id);


--
-- Name: idx_paytabs_callbacks_created_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_paytabs_callbacks_created_at ON public.paytabs_callbacks USING btree (created_at DESC);


--
-- Name: idx_products_active; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_products_active ON public.products USING btree (is_active);


--
-- Name: idx_products_created_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_products_created_at ON public.products USING btree (created_at DESC);


--
-- Name: idx_products_slug_unique; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX idx_products_slug_unique ON public.products USING btree (slug);


--
-- Name: idx_promotions_active; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_promotions_active ON public.promotions USING btree (is_active);


--
-- Name: idx_promotions_code_unique; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX idx_promotions_code_unique ON public.promotions USING btree (code);


--
-- Name: idx_promotions_created_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_promotions_created_at ON public.promotions USING btree (created_at DESC);


--
-- Name: idx_staff_users_active; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_staff_users_active ON public.staff_users USING btree (is_active);


--
-- Name: product_images_pid_pos_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX product_images_pid_pos_idx ON public.product_images USING btree (product_id, "position");


--
-- Name: uq_customer_sessions_token; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX uq_customer_sessions_token ON public.customer_sessions USING btree (token) WHERE (token IS NOT NULL);


--
-- Name: uq_customer_sessions_token_hash; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX uq_customer_sessions_token_hash ON public.customer_sessions USING btree (token_hash) WHERE (token_hash IS NOT NULL);


--
-- Name: batches batches_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.variants(id) ON DELETE CASCADE;


--
-- Name: customer_password_reset_tokens customer_password_reset_tokens_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_password_reset_tokens
    ADD CONSTRAINT customer_password_reset_tokens_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_sessions customer_sessions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_sessions
    ADD CONSTRAINT customer_sessions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: inventory inventory_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.variants(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.variants(id);


--
-- Name: password_reset_tokens password_reset_tokens_staff_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_staff_user_id_fkey FOREIGN KEY (staff_user_id) REFERENCES public.staff_users(id) ON DELETE CASCADE;


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_media product_media_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.product_media
    ADD CONSTRAINT product_media_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: shipments shipments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: variants variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.variants
    ADD CONSTRAINT variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

\unrestrict D3HOE8u9jPz13WvGxsXzMxsf3enVB44QWrD3qSaInsbRIgYhLDY4GAmkf1mRpkn

