begin;

-- Seed revisable del calendario GymVirtual septiembre 2026.
-- Ejecutar despues de 018_fitness_challenge.sql y 020_fitness_progress_rpc.sql.
-- Fuente: https://gymvirtual.com/wp-content/uploads/2026/08/Calendario-gymvirtual-septiembre26.pdf?x96925
-- Mantiene julio y agosto 2026 publicados; solo cambia el mes activo a septiembre 2026.
-- Nota: el PDF no trae enlaces clicables para el 21 al 27 de septiembre; se cargan solo las categorias visibles.

update public.fitness_months
set is_active = false
where is_active is true
  and not (year = 2026 and month = 9);

with fitness_month as (
  insert into public.fitness_months(year, month, name, source_pdf_url, status, is_active, ranking_enabled)
  values (
    2026,
    9,
    'Septiembre 2026',
    'https://gymvirtual.com/wp-content/uploads/2026/08/Calendario-gymvirtual-septiembre26.pdf?x96925',
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
  select $fitness_json$
[
  {
    "date": "2026-09-01",
    "category": "Total Body",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "Elimina Flacidez en Muslo Interno | Rutina para endurecer entrepierna | Ejercicios de piernas",
        "id": "PSuHJHzI-ow",
        "src": "https://gymvirtual.com/elimina-flacidez-en-muslo-interno-rutina-para-endurecer-entrepierna-ejercicios-de-piernas/"
      },
      {
        "o": 2,
        "t": "PIERNAS Y GLÚTEOS FUERTES Y BONITOS",
        "id": "csYiFA_eGK4",
        "src": "https://gymvirtual.com/piernas-y-gluteos-fuertes-y-bonitos/"
      },
      {
        "o": 3,
        "t": "Brazos con mancuernas 15 minutos",
        "id": "wGOoZfqoERw",
        "src": "https://gymvirtual.com/brazos-con-mancuernas-15-minutos/"
      },
      {
        "o": 4,
        "t": "Brazos con flexiones",
        "id": "6vm9HM2a2oA",
        "src": "https://gymvirtual.com/brazos-con-flexiones/"
      }
    ]
  },
  {
    "date": "2026-09-02",
    "category": "Parte superior",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "Ejercicios para ESPALDA BAJA y BRAZOS delgados y definidos con peso",
        "id": "3EJiBcea7Sc",
        "src": "https://gymvirtual.com/ejercicios-para-espalda-baja-y-brazos-delgados-y-definidos-con-peso/"
      },
      {
        "o": 2,
        "t": "¡NUEVA RUTINA! CORE BRAZOS + ESPALDA",
        "id": "pTxhy506g0g",
        "src": "https://gymvirtual.com/nueva-rutina-core-brazos-espalda/"
      },
      {
        "o": 3,
        "t": "ABOMEN FUERTE | Abdominales en 12 minutos sin material en casa",
        "id": "poTmcPKrl5o",
        "src": "https://gymvirtual.com/abomen-fuerte-abdominales-en-12-minutos-sin-material-en-casa/"
      }
    ]
  },
  {
    "date": "2026-09-03",
    "category": "GAP Cardio",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "Ejercicios para eliminar Abdomen Bajo Abultado SIN MATERIAL",
        "id": "eECRvrmMILg",
        "src": "https://gymvirtual.com/ejercicios-para-eliminar-abdomen-bajo-abultado-sin-material/"
      },
      {
        "o": 2,
        "t": "Rutina de abdomen y cintura | Abdomen fuerte",
        "id": "saMt45TpeX4",
        "src": "https://gymvirtual.com/rutina-de-abdomen-y-cintura-abdomen-fuerte/"
      },
      {
        "o": 3,
        "t": "CARDIO & ABDOMEN | 12 minutos",
        "id": "y9QawsYBTQo",
        "src": "https://gymvirtual.com/cardio-abdomen-12-minutos-2/"
      },
      {
        "o": 4,
        "t": "QUEMAR GRASA EN 15MIN CARDIO PARA ADELGAZAR",
        "id": "9a3ai0Y1eLg",
        "src": "https://gymvirtual.com/quemar-grasa-en-15min-cardio-para-adelgazar/"
      }
    ]
  },
  {
    "date": "2026-09-04",
    "category": "GAP",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "GAP SIN MATERIAL | GLÚTEOS ABDOMEN Y PIERNAS PERFECTOS",
        "id": "sCnaCAU4FfM",
        "src": "https://gymvirtual.com/gap-sin-material-gluteos-abdomen-y-piernas-perfectos/"
      },
      {
        "o": 2,
        "t": "TONIFICAR ABDOMEN | VIENTRE PLANO",
        "id": "1on7o0yDWxY",
        "src": "https://gymvirtual.com/tonificar-abdomen-vientre-plano/"
      },
      {
        "o": 3,
        "t": "Parte Inferior inferior con mancuernas",
        "id": "wDEAPbY2b1o",
        "src": "https://gymvirtual.com/parte-inferior-inferior-con-mancuernas/"
      }
    ]
  },
  {
    "date": "2026-09-05",
    "category": "Express",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "EJERCICIOS PARA TONIFICAR Y REDUCIR BRAZOS | Con mancuernas",
        "id": "8kAjFLInCwE",
        "src": "https://gymvirtual.com/ejercicios-para-tonificar-y-reducir-brazos-con-mancuernas/"
      }
    ]
  },
  {
    "date": "2026-09-06",
    "category": "Reto",
    "day_type": "challenge",
    "description": null,
    "videos": []
  },
  {
    "date": "2026-09-07",
    "category": "Full Body",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "DIRECTO – FULL BODY CARDIO – EJERCICIOS INTENSOS PARA TODO EL CUERPO",
        "id": "kjkXHwcUUwA",
        "src": "https://gymvirtual.com/directo-full-body-cardio-ejercicios-intensos-para-todo-el-cuerpo/"
      }
    ]
  },
  {
    "date": "2026-09-08",
    "category": "Total Body",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "EJERCICIOS AUMENTAR GLÚTEOS | ADIÓS NALGAS CAÍDAS",
        "id": "xG0PiG4GVK0",
        "src": "https://gymvirtual.com/ejercicios-aumentar-gluteos-adios-nalgas-caidas-2/"
      },
      {
        "o": 2,
        "t": "Ejercicios con MANCUERNAS para ABDOMEN, ESPALDA Y CINTURA",
        "id": "HU6qSfHAUXc",
        "src": "https://gymvirtual.com/ejercicios-con-mancuernas-para-abdomen-espalda-y-cintura/"
      },
      {
        "o": 3,
        "t": "glúteos y piernas | parte interna y del muslo",
        "id": "ERLp9LT0G7I",
        "src": "https://gymvirtual.com/gluteos-y-piernas-parte-interna-y-del-muslo/"
      }
    ]
  },
  {
    "date": "2026-09-09",
    "category": "Parte superior",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "Cardio brazos con mancuernas",
        "id": "8TtlGr9unRU",
        "src": "https://gymvirtual.com/cardio-brazos-con-mancuernas/"
      },
      {
        "o": 2,
        "t": "QUEMAR GRASA y ADELGAZAR BRAZOS | CARDIO BRAZOS",
        "id": "j7O1wJqTFO8",
        "src": "https://gymvirtual.com/quemar-grasa-y-adelgazar-brazos-cardio-brazos/"
      },
      {
        "o": 3,
        "t": "BRAZOS CON MANCUERNAS",
        "id": "YYHjaVexUg0",
        "src": "https://gymvirtual.com/brazos-con-mancuernas/"
      }
    ]
  },
  {
    "date": "2026-09-10",
    "category": "GAP Cardio",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "CÓMO ENSANCHAR CADERAS Y REDUCIR CINTURA EN 7 DÍAS | MEJORES EJERCICIOS EN CASA",
        "id": "VFElKRGjdMQ",
        "src": "https://gymvirtual.com/como-ensanchar-caderas-y-reducir-cintura-en-7-dias-mejores-ejercicios-en-casa/"
      },
      {
        "o": 2,
        "t": "Ejercicios para ABDOMEN BAJO | Sin material",
        "id": "n2sSLpheabY",
        "src": "https://gymvirtual.com/ejercicios-para-abdomen-bajo-sin-material/"
      },
      {
        "o": 3,
        "t": "QUEMAR GRASA Y BAJAR ABDOMEN | CORE CARDIO",
        "id": "qViYif0PpMo",
        "src": "https://gymvirtual.com/quemar-grasa-y-bajar-abdomen-core-cardio/"
      },
      {
        "o": 4,
        "t": "Glúteos y piernas perfectas | Con MANCUERNAS y SILLA",
        "id": "k9MHSvXk2eM",
        "src": "https://gymvirtual.com/gluteos-y-piernas-perfectas-con-mancuernas-y-silla/"
      }
    ]
  },
  {
    "date": "2026-09-11",
    "category": "GAP",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "AUMENTAR GLÚTEOS Y REDUCIR CINTURA | 15 minutos",
        "id": "lRfe9t45VCg",
        "src": "https://gymvirtual.com/aumentar-gluteos-y-reducir-cintura-15-minutos/"
      },
      {
        "o": 2,
        "t": "RUTINA DE PIERNAS, GLÚTEOS Y ABDOMEN 10 MIN",
        "id": "I0x-ewa3qns",
        "src": "https://gymvirtual.com/rutina-de-piernas-gluteos-y-abdomen-10-min/"
      },
      {
        "o": 3,
        "t": "GLÚTEOS, PIERNAS Y PARTE INTERNA DEL MUSLO",
        "id": "iqXEAnGfsbw",
        "src": "https://gymvirtual.com/gluteos-piernas-y-parte-interna-del-muslo/"
      }
    ]
  },
  {
    "date": "2026-09-12",
    "category": "Express",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "TONIFICA Y TRABAJA LA PARTE SUPERIOR | CON PESO",
        "id": "f4ntqtJ14VU",
        "src": "https://gymvirtual.com/tonifica-y-trabaja-la-parte-superior-con-peso/"
      }
    ]
  },
  {
    "date": "2026-09-13",
    "category": "Reto",
    "day_type": "challenge",
    "description": null,
    "videos": []
  },
  {
    "date": "2026-09-14",
    "category": "Full Body",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "DIRECTO – FULL BODY CARDIO – Ejercicios para TODO el cuerpo",
        "id": "-EbGLvT_MPE",
        "src": "https://gymvirtual.com/directo-full-body-cardio-ejercicios-para-todo-el-cuerpo/"
      }
    ]
  },
  {
    "date": "2026-09-15",
    "category": "Total Body",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "BRAZOS DELGADOS Y DEFINIDOS CON PESO / MANCUERNAS",
        "id": "z97SLRev-No",
        "src": "https://gymvirtual.com/brazos-delgados-y-definidos-con-peso-mancuernas-2/"
      },
      {
        "o": 2,
        "t": "RUTINA DE GAP | GLÚTEOS ABDOMEN Y PIERNAS PERFECTAS",
        "id": "RsRfiyTcrRM",
        "src": "https://gymvirtual.com/rutina-de-gap-gluteos-abdomen-y-piernas-perfectas/"
      },
      {
        "o": 3,
        "t": "CORE CARDIO | Ejercicios para quemar calorías y tonificar abdomen",
        "id": "7O3rBxVjv0w",
        "src": "https://gymvirtual.com/core-cardio-ejercicios-para-quemar-calorias-y-tonificar-abdomen/"
      }
    ]
  },
  {
    "date": "2026-09-16",
    "category": "Parte superior",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "PARTE SUPERIOR: BRAZOS, ABDOMEN FUERTES Y TONIFICADOS | Ejercicios con mancuernas",
        "id": "NeeQTEzT4iQ",
        "src": "https://gymvirtual.com/parte-superior-brazos-abdomen-fuertes-y-tonificados-ejercicios-con-mancuernas/"
      },
      {
        "o": 2,
        "t": "ABDOMEN FUERTE | EJERCICIOS PARA UN VIENTRE PLANO",
        "id": "UgaymrcjBbY",
        "src": "https://gymvirtual.com/abdomen-fuerte-ejercicios-para-un-vientre-plano/"
      },
      {
        "o": 3,
        "t": "Rutina de BRAZOS con PESO | Mancuernas",
        "id": "wFSm8-xav7w",
        "src": "https://gymvirtual.com/rutina-de-brazos-con-peso-mancuernas/"
      }
    ]
  },
  {
    "date": "2026-09-17",
    "category": "GAP Cardio",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "Aumentar glúteos NO NALGAS CAÍDAS Ejercicios Glúteos Grandes y Tonificados",
        "id": "lkrdg5uD6c8",
        "src": "https://gymvirtual.com/aumentar-gluteos-no-nalgas-caidas-ejercicios-gluteos-grandes-y-tonificados/"
      },
      {
        "o": 2,
        "t": "Cardio core | Ejercicios para tonificar abdomen y quemar grasa",
        "id": "Q0wDbnE4R5g",
        "src": "https://gymvirtual.com/cardio-core-ejercicios-para-tonificar-abdomen-y-quemar-grasa/"
      },
      {
        "o": 3,
        "t": "Trabajar y tonificar glúteos, abdomen y piernas",
        "id": "eGP6-i5sMF4",
        "src": "https://gymvirtual.com/trabajar-y-tonificar-gluteos-abdomen-y-piernas/"
      }
    ]
  },
  {
    "date": "2026-09-18",
    "category": "GAP",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "ABDOMEN BAJO | Ejercicios de abdominales en casa",
        "id": "g6xw9cegJwY",
        "src": "https://gymvirtual.com/abdomen-bajo-ejercicios-de-abdominales-en-casa/"
      },
      {
        "o": 2,
        "t": "Trabajo de abdomen, piernas y glúteos",
        "id": "0yi5JeFGINk",
        "src": "https://gymvirtual.com/trabajo-de-abdomen-piernas-y-gluteos/"
      },
      {
        "o": 3,
        "t": "CARDIO HIIT | 10 MIN",
        "id": "i4x0Fl-kRmk",
        "src": "https://gymvirtual.com/cardio-hiit-10-min/"
      },
      {
        "o": 4,
        "t": "Eliminar rollitos | ABDOMEN CINTURA Y ESPALDA BAJA | 10 minutos",
        "id": "s3hk4_nguqI",
        "src": "https://gymvirtual.com/eliminar-rollitos-abdomen-cintura-y-espalda-baja-10-minutos/"
      }
    ]
  },
  {
    "date": "2026-09-19",
    "category": "Express",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "BRAZOS DELGADOS Y DEFINIDOS CON MANCUERNAS Y SILLA",
        "id": "uGkvBYz2TOk",
        "src": "https://gymvirtual.com/brazos-delgados-y-definidos-con-mancuernas-y-silla/"
      }
    ]
  },
  {
    "date": "2026-09-20",
    "category": "Reto",
    "day_type": "challenge",
    "description": null,
    "videos": []
  },
  {
    "date": "2026-09-21",
    "category": "Total Body",
    "day_type": "workout",
    "description": "Directo a las 19:00 hora España. El PDF no trae enlace clicable.",
    "videos": []
  },
  {
    "date": "2026-09-22",
    "category": "Parte superior",
    "day_type": "workout",
    "description": "Masterclass. El PDF no trae enlace clicable.",
    "videos": []
  },
  {
    "date": "2026-09-23",
    "category": "GAP",
    "day_type": "workout",
    "description": "Masterclass. El PDF no trae enlace clicable.",
    "videos": []
  },
  {
    "date": "2026-09-24",
    "category": "Full Body Cardio",
    "day_type": "workout",
    "description": "Masterclass. El PDF no trae enlace clicable.",
    "videos": []
  },
  {
    "date": "2026-09-25",
    "category": "Core Cardio",
    "day_type": "workout",
    "description": "Masterclass. El PDF no trae enlace clicable.",
    "videos": []
  },
  {
    "date": "2026-09-26",
    "category": "Express",
    "day_type": "workout",
    "description": "Masterclass. El PDF no trae enlace clicable.",
    "videos": []
  },
  {
    "date": "2026-09-27",
    "category": "Estiramientos",
    "day_type": "challenge",
    "description": "Estiramientos. El PDF no trae enlace clicable.",
    "videos": []
  },
  {
    "date": "2026-09-28",
    "category": "Full Body",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "DIRECTO – ALTA INTENSIDAD – HIIT CORE",
        "id": "ERANbiKmPwg",
        "src": "https://gymvirtual.com/directo-alta-intensidad-hiit-core/"
      }
    ]
  },
  {
    "date": "2026-09-29",
    "category": "Total Body",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "TONIFICA BRAZOS Y ELIMINA ROLLITOS Y ALAS DE MURCIELAGO  REAFIRMAR BRAZOS FLÁCIDOS con PESO",
        "id": "o89Gi6F4t1Y",
        "src": "https://gymvirtual.com/tonifica-brazos-y-elimina-rollitos-y-alas-de-murcielago-reafirmar-brazos-flacidos-con-peso/"
      },
      {
        "o": 2,
        "t": "TRABAJA TU ABDOMEN BAJO | SIN MATERIAL",
        "id": "EvxjmbeObu4",
        "src": "https://gymvirtual.com/trabaja-tu-abdomen-bajo-sin-material/"
      },
      {
        "o": 3,
        "t": "Ejercicios para glúteos y piernas | CON PESO",
        "id": "i8_Nrp5UnyI",
        "src": "https://gymvirtual.com/ejercicios-para-gluteos-y-piernas-con-peso/"
      },
      {
        "o": 4,
        "t": "CARDIO BRAZOS SIN PESO | DELGADOS Y DEFINIDOS",
        "id": "RmZfnSLB2lg",
        "src": "https://gymvirtual.com/cardio-brazos-sin-peso-delgados-y-definidos/"
      },
      {
        "o": 5,
        "t": "ESPALDA BAJA, CINTURA Y ESPALDA | QUEMAR GRASA",
        "id": "4n2PcBm9MTA",
        "src": "https://gymvirtual.com/espalda-baja-cintura-y-espalda-quemar-grasa/"
      }
    ]
  },
  {
    "date": "2026-09-30",
    "category": "Parte superior",
    "day_type": "workout",
    "description": null,
    "videos": [
      {
        "o": 1,
        "t": "CORE CARDIO 10 MINUTOS",
        "id": "qPfiSmL_ZSI",
        "src": "https://gymvirtual.com/core-cardio-10-minutos/"
      },
      {
        "o": 2,
        "t": "ADELGAZAR Espalda y Brazos rápido | Elimina la grasa y los rollos",
        "id": "0X_Leb38QIg",
        "src": "https://gymvirtual.com/adelgazar-espalda-y-brazos-rapido-elimina-la-grasa-y-los-rollos/"
      },
      {
        "o": 3,
        "t": "EJERCICIOS PARA REDUCIR CINTURA Y APLANAR ABDOMEN | Abdominales 10 minutos",
        "id": "fIYgdgxQK0s",
        "src": "https://gymvirtual.com/ejercicios-para-reducir-cintura-y-aplanar-abdomen-abdominales-10-minutos/"
      },
      {
        "o": 4,
        "t": "ENDURECER BRAZOS SIN MATERIAL Y TONIFICAR ESPALDA",
        "id": "hQLeU2_3T7o",
        "src": "https://gymvirtual.com/endurecer-brazos-sin-material-y-tonificar-espalda/"
      }
    ]
  }
]
$fitness_json$::jsonb as days
), day_payload as (
  select
    fitness_month.id as fitness_month_id,
    (day_item->>'date')::date as workout_date,
    day_item->>'category' as category,
    nullif(day_item->>'description', '') as description,
    day_item->>'day_type' as day_type,
    day_item->'videos' as videos
  from payload
  cross join fitness_month
  cross join lateral jsonb_array_elements(payload.days) as day_item
), upserted_days as (
  insert into public.fitness_days(fitness_month_id, workout_date, category, title, description, day_type, sort_order)
  select
    fitness_month_id,
    workout_date,
    category,
    category,
    description,
    day_type,
    extract(day from workout_date)::integer
  from day_payload
  on conflict(fitness_month_id, workout_date) do update set
    category = excluded.category,
    title = excluded.title,
    description = excluded.description,
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
  fm.status,
  fm.is_active,
  count(distinct fd.id) as days_loaded,
  count(fv.id) as videos_loaded
from public.fitness_months fm
left join public.fitness_days fd on fd.fitness_month_id = fm.id
left join public.fitness_videos fv on fv.fitness_day_id = fd.id
where fm.year = 2026 and fm.month = 9
group by fm.name, fm.status, fm.is_active;
