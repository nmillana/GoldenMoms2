begin;

-- Seed revisable del calendario GymVirtual julio 2026.
-- Ejecutar despues de 018_fitness_challenge.sql.
-- Fuente: https://gymvirtual.com/wp-content/uploads/2026/06/Calendario-gymvirtual-julio26.pdf?x96925

update public.fitness_months
set is_active = false
where is_active is true
  and not (year = 2026 and month = 7);

with fitness_month as (
  insert into public.fitness_months(year, month, name, source_pdf_url, status, is_active, ranking_enabled)
  values (
    2026,
    7,
    'Julio 2026',
    'https://gymvirtual.com/wp-content/uploads/2026/06/Calendario-gymvirtual-julio26.pdf?x96925',
    'published',
    true,
    true
  )
  on conflict(year, month) do update set
    name = excluded.name,
    source_pdf_url = excluded.source_pdf_url,
    status = excluded.status,
    is_active = excluded.is_active,
    ranking_enabled = excluded.ranking_enabled
  returning id
), payload as (
  select $$
[
  {"date":"2026-07-01","category":"Cardio","day_type":"workout","videos":[
    {"o":1,"t":"RUTINA PARA ABDOMEN BAJO | 11 min","id":"VyTq2yCjF4o","src":"http://gymvirtual.com/rutina-para-abdomen-bajo-11-min/"},
    {"o":2,"t":"Hiit muy intenso","id":"20G9_JAi6Po","src":"http://gymvirtual.com/hiit-muy-intenso/"},
    {"o":3,"t":"Ejercicios para ABDOMEN Y CINTURA","id":"FR6kMmtWuaM","src":"http://gymvirtual.com/ejercicios-para-abdomen-y-cintura/"},
    {"o":4,"t":"KINGS & QUEENS - Ava Max | AT HOME WORKOUT","id":"s7FmlCqn3C0","src":"http://gymvirtual.com/kings-queens-ava-max-at-home-workout/"}
  ]},
  {"date":"2026-07-02","category":"Full Body Cardio","day_type":"workout","videos":[
    {"o":1,"t":"10 min de Ejercicios para Gluteos y Piernas para Levantar Gluteos","id":"3MD71nr7Tow","src":"https://gymvirtual.com/10-min-de-ejercicios-para-gluteos-y-piernas-para-levantar-gluteos/"},
    {"o":2,"t":"PARTE SUPERIOR CON MANCUERNAS | BRAZOS, ESPALDA Y HOMBROS","id":"WFDREE7KO20","src":"https://gymvirtual.com/parte-superior-con-mancuernas-brazos-espalda-y-hombros/","eq":"Mancuernas"},
    {"o":3,"t":"Ejercicios para PIERNAS y PARTE INTERNA DEL MUSLO | GymVirtual","id":"rwJvvk8FNq4","src":"http://gymvirtual.com/ejercicios-para-piernas-y-parte-interna-del-muslo-gymvirtual/"},
    {"o":4,"t":"HIIT INTENSO QUEMA GRASA | Ejercicios de CARDIO en CASA","id":"VrjuepZ4ZVs","src":"http://gymvirtual.com/hiit-intenso-quema-grasa-ejercicios-de-cardio-en-casa/"},
    {"o":5,"t":"Ejercicios para GLUTEOS Y PIERNAS PERFECTAS Y BONITAS","id":"VHYC5OJlbJo","src":"http://gymvirtual.com/ejercicios-para-gluteos-y-piernas-perfectas-y-bonitas/"}
  ]},
  {"date":"2026-07-03","category":"GAP","day_type":"workout","videos":[
    {"o":1,"t":"DIRECTO - CARDIO GAP EJERCICIOS DE GLUTEOS, ABDOMEN Y PIERNAS","id":"Rst1ZOWqKLg","src":"http://gymvirtual.com/directo-cardio-gap-ejercicios-de-gluteos-abdomen-y-piernas/"}
  ]},
  {"date":"2026-07-04","category":"Express","day_type":"workout","videos":[
    {"o":1,"t":"FORTALECER EL CUERPO | EJERCICIOS DE MOVILIDAD","id":"nvK2t0d8RbI","src":"http://gymvirtual.com/fortalecer-el-cuerpo-ejercicios-de-movilidad/"}
  ]},
  {"date":"2026-07-05","category":"Reto","day_type":"challenge","videos":[]},
  {"date":"2026-07-06","category":"Total Body","day_type":"workout","videos":[
    {"o":1,"t":"Ejercicios para ABDOMEN plano y fuerte","id":"w1311k7DFB4","src":"http://gymvirtual.com/ejercicios-para-abdomen-plano-y-fuerte/"},
    {"o":2,"t":"Gluteos, abdomen y piernas | Rutina de GAP 15 min","id":"43GGe6Z5qn0","src":"http://gymvirtual.com/gluteos-abdomen-y-piernas-rutina-de-gap-15-min/"},
    {"o":3,"t":"QUEMAR GRASA y ADELGAZAR BRAZOS | CARDIO BRAZOS","id":"j7O1wJqTFO8","src":"http://gymvirtual.com/quemar-grasa-y-adelgazar-brazos-cardio-brazos/"}
  ]},
  {"date":"2026-07-07","category":"Parte superior","day_type":"workout","videos":[
    {"o":1,"t":"Ejercicios para Tonificar Brazos Adelgazar y Definir sin Material | 10 min","id":"_pMN-eLPxTE","src":"https://gymvirtual.com/ejercicios-para-tonificar-brazos-adelgazar-y-definir-sin-material-10-min/","eq":"Sin material"},
    {"o":2,"t":"Rutina de BRAZOS Y ESPALDA | 20 MINUTOS","id":"Y3jILs2I2_c","src":"http://gymvirtual.com/rutina-de-brazos-y-espalda-20-minutos/"},
    {"o":3,"t":"ABDOMEN y CADERA - Delgada y definida - 16 MIN","id":"B1pX01yzwWg","src":"http://gymvirtual.com/abdomen-y-cadera-delgada-y-definida-16-min/"}
  ]},
  {"date":"2026-07-08","category":"Cardio","day_type":"workout","videos":[
    {"o":1,"t":"NUEVA RUTINA! CARDIO - CORE REDUCE TU ABDOMEN","id":"iBkBKOThQW4","src":"http://gymvirtual.com/nueva-rutina-cardio-core-reduce-tu-abdomen/"},
    {"o":2,"t":"Abdomen fuerte | Ejercicios en casa de abdominales","id":"CHRFq0LfSa0","src":"http://gymvirtual.com/abdomen-fuerte-ejercicios-en-casa-de-abdominales/"},
    {"o":3,"t":"CARDIO HIIT SIN IMPACTO! 12 MINUTOS","id":"tgRWRxtrrLo","src":"http://gymvirtual.com/cardio-hiit-sin-impacto-12-minutos/"},
    {"o":4,"t":"Abdominales marcados | Abdomen fuerte con planchas","id":"OiQLDZOGi7M","src":"http://gymvirtual.com/abdominales-marcados-abdomen-fuerte-con-planchas/"}
  ]},
  {"date":"2026-07-09","category":"Full Body Cardio","day_type":"workout","videos":[
    {"o":1,"t":"BRAZOS DEFINIDOS CON MANCUERNAS | TONE YOUR ARMS WORKOUT | GymVirtual","id":"80njyVbPCZc","src":"https://gymvirtual.com/brazos-definidos-con-mancuernas-tone-your-arms-workout-gymvirtual/","eq":"Mancuernas"},
    {"o":2,"t":"Ejercicios de cardio y piernas en casa | GymVirtual","id":"3cMeZX01Zuk","src":"http://gymvirtual.com/ejercicios-de-cardio-y-piernas-en-casa-gymvirtual/"},
    {"o":3,"t":"GLUTEOS Y ABDOMEN PERFECTOS | Con musica conocida Gym Virtual","id":"qm3rZ3q9DBs","src":"http://gymvirtual.com/gluteos-y-abdomen-perfectos-con-musica-conocida-gym-virtual/"},
    {"o":4,"t":"IN YOUR EYES - Robin Schulz feat Alida | WORKOUT","id":"Be3Oh8ft-CM","src":"http://gymvirtual.com/in-your-eyes-robin-schulz-feat-alida-workout/"}
  ]},
  {"date":"2026-07-10","category":"GAP","day_type":"workout","videos":[
    {"o":1,"t":"DIRECTO - RUTINA DE GAP - EJERCICIOS DE GLUTEOS ABDOMEN Y PIERNAS EN CASA","id":"Jqmu6xY31nA","src":"http://gymvirtual.com/directo-rutina-de-gap-ejercicios-de-gluteos-abdomen-y-piernas-en-casa/"}
  ]},  {"date":"2026-07-11","category":"Express","day_type":"workout","videos":[
    {"o":1,"t":"CARDIO QUEMA GRASA | INTENSO Y CORTO","id":"Y3rRu4s_mqY","src":"http://gymvirtual.com/cardio-quema-grasa-intenso-y-corto/"}
  ]},
  {"date":"2026-07-12","category":"Reto","day_type":"challenge","videos":[]},
  {"date":"2026-07-13","category":"Total Body","day_type":"workout","videos":[
    {"o":1,"t":"NUEVA RUTINA! ENTRENAMIENTO PARTE SUPERIOR","id":"sDoQkHx13po","src":"http://gymvirtual.com/nueva-rutina-entrenamiento-parte-superior/"},
    {"o":2,"t":"RUTINA PARA GLUTEOS PERFECTOS Y CADERA SIN PESO","id":"mvlWWbDSR4U","src":"http://gymvirtual.com/rutina-para-gluteos-perfectos-y-cadera-sin-peso/","eq":"Sin material"},
    {"o":3,"t":"ABDOMINALES DE PIE | Ejercicios para abdomen plano | 15 minutos","id":"4EaEW4Qa3NA","src":"http://gymvirtual.com/abdominales-de-pie-ejercicios-para-abdomen-plano-15-minutos/"}
  ]},
  {"date":"2026-07-14","category":"Parte superior","day_type":"workout","videos":[
    {"o":1,"t":"15 Ejercicios de CARDIO QUEMA GRASA todo el CUERPO Intenso y Corto","id":"CeGMfLQDXyY","src":"https://gymvirtual.com/15-ejercicios-de-cardio-quema-grasa-todo-el-cuerpo-intenso-y-corto/"},
    {"o":2,"t":"Abdomen, cintura y espalda | Ejercicios 15 minutos","id":"gglryB_YORQ","src":"http://gymvirtual.com/espalda-cintura-y-abdomen-10-minutos/"},
    {"o":3,"t":"FLEXIONES | EJERCICIOS PARA BRAZOS Y PECHO","id":"3swstXwLJRc","src":"http://gymvirtual.com/flexiones-ejercicios-para-brazos-y-pecho/"},
    {"o":4,"t":"PARTE SUPERIOR FUERTE | BRAZOS, HOMBROS Y ESPALDA","id":"Ovil4E6xEB0","src":"http://gymvirtual.com/parte-superior-fuerte-brazos-hombros-y-espalda/"}
  ]},
  {"date":"2026-07-15","category":"Cardio","day_type":"workout","videos":[
    {"o":1,"t":"ABDOMEN BAJO | Ejercicios para tonifica y aplanar","id":"aUjM3B_kZ58","src":"https://gymvirtual.com/abdomen-bajo-ejercicios-para-tonifica-y-aplanar/"},
    {"o":2,"t":"ABDOMEN FUERTE Y DEFINIDO | ABS WORKOUT 10 MIN","id":"GEAUYqB1-zE","src":"http://gymvirtual.com/abdomen-fuerte-y-definido-abs-workout-10-min/"},
    {"o":3,"t":"ABDOMINALES DE PIE","id":"7qq9lwEWlP0","src":"http://gymvirtual.com/abdominales-de-pie-3/"},
    {"o":4,"t":"QUEMAR GRASA Y BAJAR ABDOMEN | CORE CARDIO","id":"qViYif0PpMo","src":"http://gymvirtual.com/quemar-grasa-y-bajar-abdomen-core-cardio/"}
  ]},
  {"date":"2026-07-16","category":"Full Body Cardio","day_type":"workout","videos":[
    {"o":1,"t":"Eliminar Rollitos de la Espalda y Brazos con Mancuernas","id":"vbcmqGWLrGE","src":"https://gymvirtual.com/eliminar-rollitos-de-la-espalda-y-brazos-con-mancuernas/","eq":"Mancuernas"},
    {"o":2,"t":"ABDOMINALES DE PIE CON MANCUERNAS","id":"LXM7hL0vgIE","src":"https://gymvirtual.com/abdominales-de-pie-con-mancuernas/","eq":"Mancuernas"},
    {"o":3,"t":"Ejercicios para piernas delgadas y tonificadas","id":"Kpl2FDsq7wQ","src":"http://gymvirtual.com/ejercicios-para-piernas-delgadas-y-tonificadas/"},
    {"o":4,"t":"PARTE SUPERIOR CON MANCUERNAS | Abdomen, brazos y pecho","id":"ef3Zf7qpxts","src":"http://gymvirtual.com/parte-superior-con-mancuernas-abdomen-brazos-y-pecho/","eq":"Mancuernas"}
  ]},
  {"date":"2026-07-17","category":"GAP","day_type":"workout","videos":[
    {"o":1,"t":"DIRECTO - GLUTEOS, ABDOMEN Y PIERNAS - RUTINA COMPLETA DE GAP","id":"T38sZYovWZI","src":"http://gymvirtual.com/directo-gluteos-abdomen-y-piernas-rutina-completa-de-gap/"}
  ]},
  {"date":"2026-07-18","category":"Express","day_type":"workout","videos":[
    {"o":1,"t":"TOTAL BODY CON CARDIO PARA ADELGAZAR Y TONIFICAR","id":"Fjwi6NgN-kQ","src":"http://gymvirtual.com/total-body-con-cardio-para-adelgazar-y-tonificar/"}
  ]},
  {"date":"2026-07-19","category":"Reto","day_type":"challenge","videos":[]},
  {"date":"2026-07-20","category":"Total Body","day_type":"workout","videos":[
    {"o":1,"t":"NUEVA RUTINA! CORE BRAZOS + ESPALDA","id":"pTxhy506g0g","src":"http://gymvirtual.com/nueva-rutina-core-brazos-espalda/"},
    {"o":2,"t":"RUTINA AUMENTAR Y FORTALECER GLUTEOS","id":"cBY2G173ut4","src":"http://gymvirtual.com/rutina-aumentar-y-fortalecer-gluteos/"},
    {"o":3,"t":"ADELGAZA Y TONIFICA TUS PIERNAS | CARDIO QUEMA GRASA","id":"O6NkibDe4do","src":"http://gymvirtual.com/adelgaza-y-tonifica-tus-piernas-cardio-quema-grasa/"}
  ]},
  {"date":"2026-07-21","category":"Parte superior","day_type":"workout","videos":[
    {"o":1,"t":"Cardio brazos con mancuernas","id":"8TtlGr9unRU","src":"http://gymvirtual.com/cardio-brazos-con-mancuernas/","eq":"Mancuernas"},
    {"o":2,"t":"Rutina de brazos sin peso | 15 minutos","id":"4t8Y7P-3uz0","src":"http://gymvirtual.com/rutina-de-brazos-sin-peso-15-minutos/","eq":"Sin material"}
  ]},
  {"date":"2026-07-22","category":"Cardio","day_type":"workout","videos":[
    {"o":1,"t":"RUTINA FULL BODY | Ejercicios para TODO EL CUERPO","id":"NKvj2q0Xe6w","src":"http://gymvirtual.com/rutina-full-body-ejercicios-para-todo-el-cuerpo/"},
    {"o":2,"t":"Rutina para ABDOMEN con PLANCHAS","id":"3M3pxm7tk0A","src":"http://gymvirtual.com/rutina-para-abdomen-con-planchas/"},
    {"o":3,"t":"ABDOMINALES DE PIE SIN IMPACTO | GymVirtual","id":"3UOJCzbvAz4","src":"http://gymvirtual.com/abdominales-de-pie-sin-impacto-gymvirtual/"}
  ]},  {"date":"2026-07-23","category":"Full Body Cardio","day_type":"workout","videos":[
    {"o":1,"t":"Los MEJORES Super Ejercicios para Gluteos Firmes y Definidos | Rutina Completa 12 min","id":"HoWAVh9iAO8","src":"https://gymvirtual.com/los-mejores-super-ejercicios-para-gluteos-firmes-y-definidos-rutina-completa-12-min/"},
    {"o":2,"t":"FUERZA Y CARDIO | Quemar y tonificar SIN MATERIAL","id":"ZTvBn1kSWdY","src":"http://gymvirtual.com/fuerza-y-cardio-quemar-y-tonificar-sin-material/","eq":"Sin material"},
    {"o":3,"t":"PARTE INTERNA DEL MUSLO | EJERCICIOS DE PIERNAS EN CASA","id":"uowlRv2jVvA","src":"http://gymvirtual.com/parte-interna-del-muslo-ejercicios-de-piernas-en-casa/"}
  ]},
  {"date":"2026-07-24","category":"GAP","day_type":"workout","videos":[
    {"o":1,"t":"DIRECTO - GLUTEOS ABDOMEN Y PIERNAS EN CASA - RUTINA GAP","id":"G9l7Z57orhg","src":"http://gymvirtual.com/directo-gluteos-abdomen-y-piernas-en-casa-rutina-gap/"}
  ]},
  {"date":"2026-07-25","category":"Express","day_type":"workout","videos":[
    {"o":1,"t":"Ejercicios de FUERZA y CARDIO con MANCUERNAS","id":"GhxGsCnNVQA","src":"http://gymvirtual.com/ejercicios-de-fuerza-y-cardio-con-mancuernas/","eq":"Mancuernas"}
  ]},
  {"date":"2026-07-26","category":"Reto","day_type":"challenge","videos":[]},
  {"date":"2026-07-27","category":"Total Body","day_type":"workout","videos":[
    {"o":1,"t":"Ejercicios para ZONA MEDIA | Abdomen gluteos, cintura y cadera","id":"bUZWdKKW-A0","src":"https://gymvirtual.com/ejercicios-para-zona-media-abdomen-gluteos-cintura-y-cadera/"},
    {"o":2,"t":"Total Body con material | Tonificar en casa todo el cuerpo","id":"rOpFhPkbglI","src":"https://gymvirtual.com/total-body-con-material-tonificar-en-casa-todo-el-cuerpo/"},
    {"o":3,"t":"FORTALECER ABDOMEN, ESPALDA Y CINTURA CON MANCUERNAS","id":"GgYLd34Q9xw","src":"https://gymvirtual.com/fortalecer-abdomen-espalda-y-cintura-con-mancuernas/","eq":"Mancuernas"}
  ]},
  {"date":"2026-07-28","category":"Parte superior","day_type":"workout","videos":[
    {"o":1,"t":"Ejercicios para TONIFICAR BRAZOS sin peso","id":"Ac1xMBMtELI","src":"https://gymvirtual.com/ejercicios-para-tonificar-brazos-sin-peso/","eq":"Sin material"},
    {"o":2,"t":"NUEVA RUTINA! CARDIO - CORE REDUCE TU ABDOMEN","id":"iBkBKOThQW4","src":"https://gymvirtual.com/nueva-rutina-cardio-core-reduce-tu-abdomen/"},
    {"o":3,"t":"Definir BRAZOS con MANCUERNAS | Ejercicios para tonificar","id":"1cV__nyToW0","src":"https://gymvirtual.com/definir-brazos-con-mancuernas-ejercicios-para-tonificar/","eq":"Mancuernas"},
    {"o":4,"t":"TRABAJA TU ABDOMEN BAJO | SIN MATERIAL","id":"EvxjmbeObu4","src":"https://gymvirtual.com/trabaja-tu-abdomen-bajo-sin-material/","eq":"Sin material"}
  ]},
  {"date":"2026-07-29","category":"Cardio","day_type":"workout","videos":[
    {"o":1,"t":"Cardio Core | Quema grasa del abdomen","id":"NUAyTNgWNsI","src":"https://gymvirtual.com/cardio-core-quema-grasa-del-abdomen-2/"},
    {"o":2,"t":"Tonificar y adelgazar PIERNAS en casa con MANCUERNAS y CARDIO","id":"QoyrLg6trOs","src":"https://gymvirtual.com/tonificar-y-adelgazar-piernas-en-casa-con-mancuernas-y-cardio/","eq":"Mancuernas"},
    {"o":3,"t":"FORTALECE TU ABDOMEN EN CASA ASI","id":"NO2jk1B0e3Q","src":"https://gymvirtual.com/fortalece-tu-abdomen-en-casa-asi/"},
    {"o":4,"t":"CARDIO HIIT QUEMA GRASA | 10 MINUTOS","id":"GruRXt1-rQo","src":"https://gymvirtual.com/cardio-hiit-quema-grasa-10-minutos/"}
  ]},
  {"date":"2026-07-30","category":"Full Body Cardio","day_type":"workout","videos":[
    {"o":1,"t":"RUTINA PARA ADELGAZAR Y TONIFICAR Abdomen y Espalda | 12 minutos","id":"M4jaLCqETN0","src":"http://gymvirtual.com/rutina-para-adelgazar-y-tonificar-abdomen-y-espalda-12-minutos"},
    {"o":2,"t":"CORE CARDIO 10 MINUTOS","id":"qPfiSmL_ZSI","src":"http://gymvirtual.com/core-cardio-10-minutos/"},
    {"o":3,"t":"PARTE SUPERIOR CON MANCUERNAS | Abdomen, brazos y pecho","id":"ef3Zf7qpxts","src":"https://gymvirtual.com/parte-superior-con-mancuernas-abdomen-brazos-y-pecho/","eq":"Mancuernas"},
    {"o":4,"t":"RUTINA PARA ABDOMEN BAJO | 11 min","id":"VyTq2yCjF4o","src":"https://gymvirtual.com/rutina-para-abdomen-bajo-11-min/"},
    {"o":5,"t":"Rutina de GAP | Gluteos, abdomen y piernas en casa","id":"Cu9bkiGpScY","src":"https://gymvirtual.com/rutina-de-gap-gluteos-abdomen-y-piernas-en-casa/"}
  ]},
  {"date":"2026-07-31","category":"GAP","day_type":"workout","videos":[
    {"o":1,"t":"DIRECTO - RUTINA COMPLETA DE GAP - GLUTEOS ABDOMEN Y PIERNAS","id":"YLqDcAQlGzI","src":"https://gymvirtual.com/directo-rutina-completa-de-gap-gluteos-abdomen-y-piernas/"}
  ]}
]
$$::jsonb as days
), day_payload as (
  select
    fitness_month.id as fitness_month_id,
    (day_item->>'date')::date as workout_date,
    day_item->>'category' as category,
    day_item->>'day_type' as day_type,
    day_item->'videos' as videos
  from payload
  cross join fitness_month
  cross join lateral jsonb_array_elements(payload.days) as day_item
), upserted_days as (
  insert into public.fitness_days(fitness_month_id, workout_date, category, title, day_type, sort_order)
  select
    fitness_month_id,
    workout_date,
    category,
    category,
    day_type,
    extract(day from workout_date)::integer
  from day_payload
  on conflict(fitness_month_id, workout_date) do update set
    category = excluded.category,
    title = excluded.title,
    day_type = excluded.day_type,
    sort_order = excluded.sort_order
  returning id, fitness_month_id, workout_date
), video_payload as (
  select
    ud.id as fitness_day_id,
    video_item->>'t' as title,
    'https://www.youtube.com/watch?v=' || (video_item->>'id') as original_url,
    'https://www.youtube-nocookie.com/embed/' || (video_item->>'id') as embed_url,
    video_item->>'src' as source_page_url,
    nullif(video_item->>'eq', '') as equipment,
    (video_item->>'o')::integer as sort_order
  from day_payload dp
  join upserted_days ud
    on ud.fitness_month_id = dp.fitness_month_id
   and ud.workout_date = dp.workout_date
  cross join lateral jsonb_array_elements(dp.videos) as video_item
)
insert into public.fitness_videos(
  fitness_day_id,
  title,
  original_url,
  embed_url,
  video_provider,
  source_page_url,
  equipment,
  activity_type,
  sort_order
)
select
  fitness_day_id,
  title,
  original_url,
  embed_url,
  'youtube',
  source_page_url,
  equipment,
  'required',
  sort_order
from video_payload
on conflict(fitness_day_id, sort_order) do update set
  title = excluded.title,
  original_url = excluded.original_url,
  embed_url = excluded.embed_url,
  video_provider = excluded.video_provider,
  source_page_url = excluded.source_page_url,
  equipment = excluded.equipment,
  activity_type = excluded.activity_type;

commit;

select
  fm.name,
  count(distinct fd.id) as days_loaded,
  count(fv.id) as videos_loaded
from public.fitness_months fm
left join public.fitness_days fd on fd.fitness_month_id = fm.id
left join public.fitness_videos fv on fv.fitness_day_id = fd.id
where fm.year = 2026 and fm.month = 7
group by fm.name;