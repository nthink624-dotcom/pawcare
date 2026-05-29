alter table public.pets
  add column if not exists bite_level text not null default 'none';

alter table public.pets
  drop constraint if exists pets_bite_level_check;

alter table public.pets
  add constraint pets_bite_level_check
  check (bite_level in ('none', 'mild', 'watch', 'bite', 'strong'));

update public.pets
set bite_level = 'none'
where bite_level is null;
