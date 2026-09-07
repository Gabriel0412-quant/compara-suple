create or replace function public.aplicar_links_afiliados_ml(
  p_store_id bigint,
  p_catalog_id text,
  p_items jsonb,
  p_simular boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_offer record;
  v_recebidas integer := 0;
  v_alteradas integer := 0;
  v_iguais integer := 0;
  v_result jsonb;
begin
  if p_store_id is null or nullif(p_catalog_id, '') is null then
    raise exception 'affiliate_link_target_invalid';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'affiliate_link_items_invalid';
  end if;
  begin
    if exists (
      select 1 from jsonb_array_elements(p_items) as i(item)
       where jsonb_typeof(item) is distinct from 'object'
          or jsonb_typeof(item->'external_id') is distinct from 'string'
          or jsonb_typeof(item->'seller_id') is distinct from 'number'
          or jsonb_typeof(item->'url') is distinct from 'string'
    ) or exists (
      select 1
        from jsonb_to_recordset(p_items) as i(external_id text, seller_id bigint, url text, affiliate_link jsonb)
       where nullif(i.external_id, '') is null
          or i.seller_id is null
          or i.seller_id <= 0
          or nullif(i.url, '') is null
          or jsonb_typeof(i.affiliate_link) is distinct from 'object'
    ) then
      raise exception 'affiliate_link_item_invalid';
    end if;
  exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then
    raise exception 'affiliate_link_item_invalid';
  end;
  if exists (
    select external_id
      from jsonb_to_recordset(p_items) as i(external_id text, seller_id bigint, url text, affiliate_link jsonb)
     group by external_id
    having count(*) > 1
  ) then
    raise exception 'affiliate_link_duplicate_item';
  end if;

  begin
    for v_item in
      select *
        from jsonb_to_recordset(p_items) as i(external_id text, seller_id bigint, url text, affiliate_link jsonb)
       order by external_id
    loop
      select o.id, o.url, o.raw
        into v_offer
        from public.offer o
       where o.store_id = p_store_id
         and o.source_catalog_id = p_catalog_id
         and o.external_id = v_item.external_id
         and o.raw->>'seller_id' = v_item.seller_id::text
       for update;
      if not found then
        raise exception 'affiliate_link_identity_invalid';
      end if;

      v_recebidas := v_recebidas + 1;
      if v_offer.url is not distinct from v_item.url
        and v_offer.raw->'affiliate_link' is not distinct from v_item.affiliate_link then
        v_iguais := v_iguais + 1;
      else
        update public.offer
           set url = v_item.url,
               raw = jsonb_set(v_offer.raw, '{affiliate_link}', v_item.affiliate_link, true)
         where id = v_offer.id
           and store_id = p_store_id
           and source_catalog_id = p_catalog_id
           and external_id = v_item.external_id
           and raw->>'seller_id' = v_item.seller_id::text;
        if not found then
          raise exception 'affiliate_link_identity_changed';
        end if;
        v_alteradas := v_alteradas + 1;
      end if;
    end loop;

    v_result := jsonb_build_object(
      'simulado', coalesce(p_simular, false),
      'recebidas', v_recebidas,
      'alteradas', v_alteradas,
      'iguais', v_iguais
    );
    if p_simular then
      raise exception using errcode = 'MLSIM', message = v_result::text;
    end if;
  exception when sqlstate 'MLSIM' then
    get stacked diagnostics v_result = message_text;
  end;

  return v_result;
end;
$$;

revoke all on function public.aplicar_links_afiliados_ml(bigint, text, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.aplicar_links_afiliados_ml(bigint, text, jsonb, boolean)
  to service_role;
