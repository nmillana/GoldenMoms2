begin;

-- Seed revisable del calendario GymVirtual agosto 2026.
-- Ejecutar despues de 018_fitness_challenge.sql y 020_fitness_progress_rpc.sql.
-- Fuente: https://gymvirtual.com/wp-content/uploads/2026/07/Calendario-gymvirtual-agosto26.pdf?x96925
-- Mantiene julio 2026 publicado; solo cambia el mes activo a agosto 2026.

update public.fitness_months
set is_active = false
where is_active is true
  and not (year = 2026 and month = 8);

with fitness_month as (
  insert into public.fitness_months(year, month, name, source_pdf_url, status, is_active, ranking_enabled)
  values (
    2026,
    8,
    'Agosto 2026',
    'https://gymvirtual.com/wp-content/uploads/2026/07/Calendario-gymvirtual-agosto26.pdf?x96925',
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
  {
    "date": "2026-08-01",
    "category": "Express",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "QUEMAR GRASA Abdomen y cintura con ejercicios de CARDIO",
        "id": "Tuy04yg2stQ",
        "src": "https://gymvirtual.com/quemar-grasa-abdomen-y-cintura-con-ejercicios-de-cardio/"
      }
    ]
  },
  {
    "date": "2026-08-02",
    "category": "Reto",
    "day_type": "challenge",
    "videos": []
  },
  {
    "date": "2026-08-03",
    "category": "Cardio Core",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "Abdomen plano y cintura definida",
        "id": "q-EQC4D2Cpo",
        "src": "https://gymvirtual.com/abdomen-plano-y-cintura-definida/"
      },
      {
        "o": 2,
        "t": "Cardio quema grasa",
        "id": "nSuorf5w5jM",
        "src": "https://gymvirtual.com/cardio-quema-grasa/"
      },
      {
        "o": 3,
        "t": "CARDIO QUEMA GRASA CON FUERZA",
        "id": "sKjyIm-G3HM",
        "src": "https://gymvirtual.com/cardio-quema-grasa-con-fuerza/"
      },
      {
        "o": 4,
        "t": "ABDOMEN BAJO | Ejercicios focalizados de abdominales",
        "id": "SHczCcRYTXc",
        "src": "https://gymvirtual.com/abdomen-bajo-ejercicios-focalizados-de-abdominales/"
      }
    ]
  },
  {
    "date": "2026-08-04",
    "category": "Total Body",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "EJERCICIOS PARA AUMENTAR GL\u00daTEOS Y CADERAS CON SENTADILLAS 10 MIN | NO EQUIPMENT",
        "id": "JcGHuzGQAso",
        "src": "https://gymvirtual.com/ejercicios-para-aumentar-gluteos-y-caderas-con-sentadillas-10-min-no-equipment/",
        "eq": "Sin material"
      },
      {
        "o": 2,
        "t": "TONIFICAR BRAZOS | Delgados y definidos con mancuernas",
        "id": "y-YqqdC7FvY",
        "src": "https://gymvirtual.com/tonificar-brazos-delgados-y-definidos-con-mancuernas/",
        "eq": "Mancuernas"
      },
      {
        "o": 3,
        "t": "EJERCICIOS PARA ABDOMEN Y GL\u00daTEOS | GYMVIRTUAL",
        "id": "Dd6Y8HLKVOc",
        "src": "https://gymvirtual.com/ejercicios-para-abdomen-y-gluteos-gymvirtual/"
      }
    ]
  },
  {
    "date": "2026-08-05",
    "category": "Parte superior",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "DIRECTO \u2013 EJERCICIOS PARA BRAZOS, PECHO Y ESPALDA",
        "id": "mfDaq4mTrDw",
        "src": "https://gymvirtual.com/directo-ejercicios-para-brazos-pecho-y-espalda-2/"
      }
    ]
  },
  {
    "date": "2026-08-06",
    "category": "Full Body Cardio",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "Caderas y Piernas parte interna del muslo NO EQUIPMENT",
        "id": "P51RHf0lFt4",
        "src": "https://gymvirtual.com/caderas-y-piernas-parte-interna-del-muslo-no-equipment/",
        "eq": "Sin material"
      },
      {
        "o": 2,
        "t": "CARDIO GAP QUEMA GRASA | GL\u00daTEOS ABDOMEN Y PIERNAS",
        "id": "CfMJom9fwek",
        "src": "https://gymvirtual.com/cardio-gap-quema-grasa-gluteos-abdomen-y-piernas/"
      },
      {
        "o": 3,
        "t": "ABDOMEN EXPRESS PARA BAJAR PANZA | RUTINA 13 MINUTOS",
        "id": "LzRmXIhRVMQ",
        "src": "https://gymvirtual.com/abdomen-express-para-bajar-panza-rutina-13-minutos/"
      }
    ]
  },
  {
    "date": "2026-08-07",
    "category": "GAP",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "GAP SIN MATERIAL | GL\u00daTEOS ABDOMEN Y PIERNAS PERFECTOS",
        "id": "sCnaCAU4FfM",
        "src": "https://gymvirtual.com/gap-sin-material-gluteos-abdomen-y-piernas-perfectos/",
        "eq": "Sin material"
      },
      {
        "o": 2,
        "t": "ABDOMEN FUERTE | EJERCICIOS PARA UN VIENTRE PLANO",
        "id": "UgaymrcjBbY",
        "src": "https://gymvirtual.com/abdomen-fuerte-ejercicios-para-un-vientre-plano/"
      },
      {
        "o": 3,
        "t": "Gl\u00fateos, abdomen y piernas | Rutina GAP 15 Minutos",
        "id": "STypt0Idtvw",
        "src": "https://gymvirtual.com/gluteos-abdomen-y-piernas-rutina-gap-15-minutos/"
      }
    ]
  },
  {
    "date": "2026-08-08",
    "category": "Express",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "ABDOMEN Y BRAZOS CON MANCUERNAS | Tonificar parte superior",
        "id": "YY_HEJri6xE",
        "src": "https://gymvirtual.com/abdomen-y-brazos-con-mancuernas-tonificar-parte-superior/",
        "eq": "Mancuernas"
      }
    ]
  },
  {
    "date": "2026-08-09",
    "category": "Reto",
    "day_type": "challenge",
    "videos": []
  },
  {
    "date": "2026-08-10",
    "category": "Cardio Core",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "QUEMA GRASA Y REDUCE ABDOMEN \ud83d\udd25\ud83d\udd25\ud83d\udd25 | CARDIO CORE",
        "id": "b7g3ZhDLE24",
        "src": "https://gymvirtual.com/quema-grasa-y-reduce-abdomen-cardio-core/"
      },
      {
        "o": 2,
        "t": "REDUCIR ABDOMEN Y CINTURA EN 15 MINUTOS",
        "id": "ZlSHoSqljgs",
        "src": "https://gymvirtual.com/reducir-abdomen-y-cintura-en-15-minutos/"
      },
      {
        "o": 3,
        "t": "Cardio quema grasa \ud83d\udd25 y abdomen plano",
        "id": "H-ppjTWvHss",
        "src": "https://gymvirtual.com/cardio-quema-grasa-y-abdomen-plano/"
      }
    ]
  },
  {
    "date": "2026-08-11",
    "category": "Total Body",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "Rutina de HOMBROS ABDOMEN Y REDUCIR CINTURA",
        "id": "6B_YRN7M9yw",
        "src": "https://gymvirtual.com/rutina-de-hombros-abdomen-y-reducir-cintura/"
      },
      {
        "o": 2,
        "t": "ABDOMINALES DE PIE",
        "id": "7qq9lwEWlP0",
        "src": "https://gymvirtual.com/abdominales-de-pie-3/"
      },
      {
        "o": 3,
        "t": "EJERCICIOS CON TOALLA | PARTE SUPERIOR 15 MIN",
        "id": "P1wBfFMJQ7A",
        "src": "https://gymvirtual.com/ejercicios-con-toalla-parte-superior-15-min/",
        "eq": "Toalla"
      },
      {
        "o": 4,
        "t": "GL\u00daTEOS TONIFICADOS Y ABDOMEN FUERTE",
        "id": "rHwvHZxcXVQ",
        "src": "https://gymvirtual.com/gluteos-tonificados-y-abdomen-fuerte/"
      }
    ]
  },
  {
    "date": "2026-08-12",
    "category": "Parte superior",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "DIRECTO \u2013 PARTE SUPERIOR \u2013 BRAZOS, PECHO, ESPALDA Y ABDOMEN",
        "id": "CUUrG7gnG-k",
        "src": "https://gymvirtual.com/directo-parte-superior-brazos-pecho-espalda-y-abdomen/"
      }
    ]
  },
  {
    "date": "2026-08-13",
    "category": "Full Body Cardio",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "EJERCICIOS CON MANCUERNAS | TONIFICA BRAZOS Y ELIMINA ROLLITOS DE LA ESPALDA",
        "id": "8I463L8UaTI",
        "src": "https://gymvirtual.com/ejercicios-con-mancuernas-tonifica-brazos-y-elimina-rollitos-de-la-espalda/",
        "eq": "Mancuernas"
      },
      {
        "o": 2,
        "t": "PARTE SUPERIOR FUERTE | BRAZOS, HOMBROS Y ESPALDA",
        "id": "Ovil4E6xEB0",
        "src": "https://gymvirtual.com/parte-superior-fuerte-brazos-hombros-y-espalda/"
      },
      {
        "o": 3,
        "t": "Cintura y espalda con MANCUERNAS | Tonificar parte superior",
        "id": "pSQy7zKVCKg",
        "src": "https://gymvirtual.com/cintura-y-espalda-con-mancuernas-tonificar-parte-superior/",
        "eq": "Mancuernas"
      },
      {
        "o": 4,
        "t": "FULL BODY CARDIO CON MANCUERNAS EXPRESS | 15 minutos",
        "id": "DFh2nctSCGw",
        "src": "https://gymvirtual.com/full-body-cardio-con-mancuernas-express-15-minutos/",
        "eq": "Mancuernas"
      }
    ]
  },
  {
    "date": "2026-08-14",
    "category": "GAP",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "ABDOMEN y CADERA \u2013 Delgada y definida \u2013 16 MIN",
        "id": "B1pX01yzwWg",
        "src": "https://gymvirtual.com/abdomen-y-cadera-delgada-y-definida-16-min/"
      },
      {
        "o": 2,
        "t": "PIERNAS DELGADAS CON CARDIO QUEMA GRASA",
        "id": "_5aOB14dNjY",
        "src": "https://gymvirtual.com/piernas-delgadas-con-cardio-quema-grasa/"
      },
      {
        "o": 3,
        "t": "RUTINA PARA GL\u00daTEOS REDONDOS y ABDOMEN PLANO",
        "id": "lT_pCYcrPNU",
        "src": "https://gymvirtual.com/rutina-para-gluteos-redondos-y-abdomen-plano/"
      }
    ]
  },
  {
    "date": "2026-08-15",
    "category": "Express",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "CARDIO QUEMA GRASA CON BRAZOS Y MANCUERNAS",
        "id": "oHzn8Tlj3EA",
        "src": "https://gymvirtual.com/cardio-quema-grasa-con-brazos-y-mancuernas/",
        "eq": "Mancuernas"
      }
    ]
  },
  {
    "date": "2026-08-16",
    "category": "Reto",
    "day_type": "challenge",
    "videos": []
  },
  {
    "date": "2026-08-17",
    "category": "Cardio Core",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "ABDOMINALES DE PIE | ABDOMEN FUERTE 15 MINUTOS",
        "id": "CtbQE6bc66k",
        "src": "https://gymvirtual.com/abdominales-de-pie-abdomen-fuerte-15-minutos/"
      },
      {
        "o": 2,
        "t": "Ejercicios para abdomen | Bajar barriga",
        "id": "q_mdN0vqV9I",
        "src": "https://gymvirtual.com/ejercicios-para-abdomen-bajar-barriga/"
      },
      {
        "o": 3,
        "t": "CARDIO HIIT | QUEMA GRASA",
        "id": "VQaL8POVv64",
        "src": "https://gymvirtual.com/cardio-hiit-quema-grasa/"
      }
    ]
  },
  {
    "date": "2026-08-18",
    "category": "Total Body",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "Reducir Cadera y Cintura Ejercicios sin Peso Cintura de Avispa Mejores ejercicios",
        "id": "L0zeYO_Wx-Q",
        "src": "https://gymvirtual.com/reducir-cadera-y-cintura-ejercicios-sin-peso-cintura-de-avispa-mejores-ejercicios/",
        "eq": "Sin material"
      },
      {
        "o": 2,
        "t": "Ejercicios para brazos en casa | Sin material",
        "id": "eX5Li1yFt1A",
        "src": "https://gymvirtual.com/ejercicios-para-brazos-en-casa-sin-material/",
        "eq": "Sin material"
      },
      {
        "o": 3,
        "t": "Espalda sana y abdomen fuerte con mancuernas | 13 MIN",
        "id": "J-wahk_n1X8",
        "src": "https://gymvirtual.com/espalda-sana-y-abdomen-fuerte-con-mancuernas-13-min/",
        "eq": "Mancuernas"
      },
      {
        "o": 4,
        "t": "AUMENTAR GL\u00daTEOS con MANCUERNAS | Ejercicios para hacer en casa",
        "id": "swQImcVCTtY",
        "src": "https://gymvirtual.com/aumentar-gluteos-con-mancuernas-ejercicios-para-hacer-en-casa/",
        "eq": "Mancuernas"
      }
    ]
  },
  {
    "date": "2026-08-19",
    "category": "Parte superior",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "DIRECTO \u2013 Brazos, pecho, espalda y abdomen | PARTE SUPERIOR",
        "id": "m19GcmSH-oY",
        "src": "https://gymvirtual.com/directo-brazos-pecho-espalda-y-abdomen-parte-superior/"
      }
    ]
  },
  {
    "date": "2026-08-20",
    "category": "Full Body Cardio",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "Cardio INTENSO 15 minutos | Quemar grasa de forma r\u00e1pida",
        "id": "CeDQT92eKAA",
        "src": "https://gymvirtual.com/cardio-intenso-15-minutos-quemar-grasa-de-forma-rapida/"
      },
      {
        "o": 2,
        "t": "TONIFICA Y TRABAJA LA PARTE SUPERIOR | CON PESO",
        "id": "f4ntqtJ14VU",
        "src": "https://gymvirtual.com/tonifica-y-trabaja-la-parte-superior-con-peso/",
        "eq": "Peso"
      },
      {
        "o": 3,
        "t": "REDUCIR CINTURA Y APLANAR ABDOMEN EN CASA",
        "id": "uqEsLecR5Gs",
        "src": "https://gymvirtual.com/reducir-cintura-y-aplanar-abdomen-en-casa/"
      },
      {
        "o": 4,
        "t": "AUMENTAR GL\u00daTEOS Y TONIFICAR PIERNAS Y ABDOMEN CON MANCUERNAS Y SILLA | EN CASA",
        "id": "drMFGT6S1QQ",
        "src": "https://gymvirtual.com/aumentar-gluteos-y-tonificar-piernas-y-abdomen-con-mancuernas-y-silla-en-casa/",
        "eq": "Mancuernas y silla"
      }
    ]
  },
  {
    "date": "2026-08-21",
    "category": "GAP",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "Rutina para gl\u00fateos y piernas | 13 minutos",
        "id": "TYWEHD11bnM",
        "src": "https://gymvirtual.com/rutina-para-gluteos-y-piernas-13-minutos/"
      },
      {
        "o": 2,
        "t": "ABDOMEN INTENSO | 8 MINUTOS",
        "id": "d4NiFzKDQAo",
        "src": "https://gymvirtual.com/abdomen-intenso-8-minutos/"
      },
      {
        "o": 3,
        "t": "PARTE INTERNA DEL MUSLO | Ejercicios para piernas perfectas",
        "id": "0jsUJcv3cJ0",
        "src": "https://gymvirtual.com/parte-interna-del-muslo-ejercicios-para-piernas-perfectas/"
      },
      {
        "o": 4,
        "t": "CARDIO PIERNAS Y GL\u00daTEOS | 13 MINUTOS",
        "id": "PMdtfoio9mM",
        "src": "https://gymvirtual.com/cardio-piernas-y-gluteos-13-minutos/"
      }
    ]
  },
  {
    "date": "2026-08-22",
    "category": "Express",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "TONIFICAR PARTE SUPERIOR | GANAR MASA MUSCULAR",
        "id": "2g5P7aQOY4E",
        "src": "https://gymvirtual.com/tonificar-parte-superior-ganar-masa-muscular/"
      }
    ]
  },
  {
    "date": "2026-08-23",
    "category": "Reto",
    "day_type": "challenge",
    "videos": []
  },
  {
    "date": "2026-08-24",
    "category": "Cardio Core",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "CARDIO QUEMA GRASA | Eliminar calor\u00edas",
        "id": "X6HlVqwy8VE",
        "src": "https://gymvirtual.com/cardio-quema-grasa-eliminar-calorias/"
      },
      {
        "o": 2,
        "t": "Ejercicios para ABDOMEN plano y fuerte",
        "id": "w1311k7DFB4",
        "src": "https://gymvirtual.com/ejercicios-para-abdomen-plano-y-fuerte/"
      },
      {
        "o": 3,
        "t": "ABDOMEN PLANO | CORE CARDIO | BAJAR LA PANZA",
        "id": "B2Kqkek9XXM",
        "src": "https://gymvirtual.com/abdomen-plano-core-cardio-bajar-la-panza/"
      }
    ]
  },
  {
    "date": "2026-08-25",
    "category": "Total Body",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "EJERCICIOS PARA ABDOMEN Y CINTURA | REDUCE CINTURA Y APLANA TU ABDOMEN EN 10 MINUTOS",
        "id": "dz3tYxEI21M",
        "src": "https://gymvirtual.com/ejercicios-para-abdomen-y-cintura-reduce-cintura-y-aplana-tu-abdomen-en-10-minutos/"
      },
      {
        "o": 2,
        "t": "TOTAL BODY | Ejercicios con mancuernas para todo el cuerpo",
        "id": "yj-lq2OGL18",
        "src": "https://gymvirtual.com/total-body-ejercicios-con-mancuernas-para-todo-el-cuerpo/",
        "eq": "Mancuernas"
      },
      {
        "o": 3,
        "t": "ABDOMINALES DE PIE SIN IMPACTO | GymVirtual",
        "id": "3UOJCzbvAz4",
        "src": "https://gymvirtual.com/abdominales-de-pie-sin-impacto-gymvirtual/"
      }
    ]
  },
  {
    "date": "2026-08-26",
    "category": "Parte superior",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "DIRECTO \u2013 Ejercicios para pecho, brazos y espalda \u2013 PARTE SUPERIOR",
        "id": "Ehku4V2oMHM",
        "src": "https://gymvirtual.com/directo-ejercicios-para-pecho-brazos-y-espalda-parte-superior/"
      }
    ]
  },
  {
    "date": "2026-08-27",
    "category": "Full Body Cardio",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "Super Ejercicios para Gl\u00fateos Firmes | Rutina Completa 14 Min | Sin Equipo",
        "id": "CfklorJ62FY",
        "src": "https://gymvirtual.com/super-ejercicios-para-gluteos-firmes-rutina-completa-14-min-sin-equipo/",
        "eq": "Sin material"
      },
      {
        "o": 2,
        "t": "MOLDEA Y TONIFICA GL\u00daTEOS Y PIERNAS",
        "id": "M59Lf7uoo40",
        "src": "https://gymvirtual.com/moldea-y-tonifica-gluteos-y-piernas/"
      },
      {
        "o": 3,
        "t": "CARDIO HIIT | ELIMINA GRASA",
        "id": "AG6FNwQZ-lQ",
        "src": "https://gymvirtual.com/cardio-hiit-elimina-grasa/"
      },
      {
        "o": 4,
        "t": "Ejercicios para abdomen 10 minutos | Bajar barriga r\u00e1pido",
        "id": "qXZKlo5GTvY",
        "src": "https://gymvirtual.com/ejercicios-para-abdomen-10-minutos-bajar-barriga-rapido/"
      },
      {
        "o": 5,
        "t": "Parte SUPERIOR con MANCUERNAS | Tonificar el cuerpo 8 MIN",
        "id": "Y5G1StBBx7k",
        "src": "https://gymvirtual.com/parte-superior-con-mancuernas-tonificar-el-cuerpo-8-min/",
        "eq": "Mancuernas"
      }
    ]
  },
  {
    "date": "2026-08-28",
    "category": "GAP",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "PIERNAS FUERTES Y GL\u00daTEOS BONITOS | Ejercicios con mancuernas",
        "id": "gjQnmg-K-74",
        "src": "https://gymvirtual.com/piernas-fuertes-y-gluteos-bonitos-ejercicios-con-mancuernas/",
        "eq": "Mancuernas"
      },
      {
        "o": 2,
        "t": "Gl\u00fateos fuertes | Ejercicios para hacer en casa 15 MIN",
        "id": "FcArGa6F85o",
        "src": "https://gymvirtual.com/gluteos-fuertes-ejercicios-para-hacer-en-casa-15-min/"
      },
      {
        "o": 3,
        "t": "ABDOMEN BAJO | Ejercicios de abdominales en casa",
        "id": "g6xw9cegJwY",
        "src": "https://gymvirtual.com/abdomen-bajo-ejercicios-de-abdominales-en-casa/"
      },
      {
        "o": 4,
        "t": "CORE CARDIO | QUEMAR GRASA ABDOMEN",
        "id": "syc6dGelHCU",
        "src": "https://gymvirtual.com/core-cardio-quemar-grasa-abdomen/"
      }
    ]
  },
  {
    "date": "2026-08-29",
    "category": "Express",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "HIIT INTENSO QUEMA GRASA | Ejercicios de CARDIO en CASA",
        "id": "VrjuepZ4ZVs",
        "src": "https://gymvirtual.com/hiit-intenso-quema-grasa-ejercicios-de-cardio-en-casa/"
      }
    ]
  },
  {
    "date": "2026-08-30",
    "category": "Reto",
    "day_type": "challenge",
    "videos": []
  },
  {
    "date": "2026-08-31",
    "category": "Cardio Core",
    "day_type": "workout",
    "videos": [
      {
        "o": 1,
        "t": "Ejercicios para REDUCIR ABDOMEN BAJO y ELIMINAR el VIENTRE ABULTADO",
        "id": "eLhGwExgnvY",
        "src": "https://gymvirtual.com/ejercicios-para-reducir-abdomen-bajo-y-eliminar-el-vientre-abultado/"
      },
      {
        "o": 2,
        "t": "Cardio Hiit INTENSO | Eliminar Grasa R\u00e1pido",
        "id": "Y5mO8HKddYY",
        "src": "https://gymvirtual.com/cardio-hiit-intenso-eliminar-grasa-rapido/"
      },
      {
        "o": 3,
        "t": "ABDOMEN, CINTURA Y ESPALDA | 12 minutos",
        "id": "orUNbIh3muY",
        "src": "https://gymvirtual.com/abdomen-cintura-y-espalda-12-minutos/"
      },
      {
        "o": 4,
        "t": "Abdominales de pie | Ejercicios para tonificar abdomen sin material",
        "id": "p0hwfY2Uh1M",
        "src": "https://gymvirtual.com/abdominales-de-pie-ejercicios-para-tonificar-abdomen-sin-material/",
        "eq": "Sin material"
      }
    ]
  }
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
  fm.status,
  fm.is_active,
  count(distinct fd.id) as days_loaded,
  count(fv.id) as videos_loaded
from public.fitness_months fm
left join public.fitness_days fd on fd.fitness_month_id = fm.id
left join public.fitness_videos fv on fv.fitness_day_id = fd.id
where fm.year = 2026 and fm.month = 8
group by fm.name, fm.status, fm.is_active;
