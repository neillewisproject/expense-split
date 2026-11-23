// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_rare_diamondback.sql';
import m0001 from './0001_luxuriant_gamma_corps.sql';
import m0002 from './0002_swift_zuras.sql';
import m0003 from './0003_perfect_junta.sql';
import m0004 from './0004_white_wildside.sql';
import m0005 from './0005_acoustic_bullseye.sql';
import m0006 from './0006_minor_tyger_tiger.sql';
import m0007 from './0007_small_the_executioner.sql';
import m0008 from './0008_amused_white_queen.sql';
import m0009 from './0009_shocking_omega_sentinel.sql';
import m0010 from './0010_yielding_black_cat.sql';

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
    m0003,
    m0004,
    m0005,
    m0006,
    m0007,
    m0008,
    m0009,
    m0010,
  },
};
