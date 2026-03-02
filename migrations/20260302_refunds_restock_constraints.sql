alter table refunds add constraint refunds_order_fk foreign key (order_id) references orders(id);
alter table restock_jobs add constraint restock_jobs_refund_fk foreign key (refund_id) references refunds(id);
