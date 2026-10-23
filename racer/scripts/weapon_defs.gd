class_name WeaponDefs
## Data-driven weapons. Each weapon is a plain Dictionary (trigger rules + stats), so the
## roguelite layer can roll random weapons/upgrades by copying and tweaking these
## (e.g. lock_time, count, damage, a different mine type or ultimate).
##
## slot "front": fired at a lock target  | trigger.type "lock"
## slot "rear":  dropped behind the car  | trigger.type "tailgate"
## slot "ultimate": charged by the ULT meter, activated by double-tap / E
##   kind "barrage" now; "emp" and "shield" are reserved kinds for later.

const ROCKET := {
	"id": "rocket", "name": "ROCKET", "slot": "front", "kind": "rocket",
	"ammo": 6, "ammo_max": 6, "refill_per_lap": 2, "cooldown": 0.55,
	"trigger": {"type": "lock", "cone_deg": 25.0, "range": 90.0, "min_range": 5.0, "lock_time": 0.6,
		"fire_delay": 0.12, "los": true, "prefer": "nearest_ahead"},
	"count": 1,          # rockets per trigger (upgrade: twin / quad salvo)
	"projectile": {"speed": 74.0, "launch_speed": 34.0, "rise_time": 0.32, "turn": 3.4, "life": 3.2,
		"damage": 26.0, "radius": 6.5, "size": 1.0, "fuse": 2.2},
}

const MINE := {
	"id": "mine", "name": "MINE", "slot": "rear", "kind": "mine",
	"ammo": 3, "ammo_max": 3, "refill_per_lap": 1, "cooldown": 2.5,
	"trigger": {"type": "tailgate", "min": 4.0, "max": 22.0, "cone_deg": 20.0, "on_road": true},
	"arm": 0.4, "trigger_radius": 2.6, "damage": 28.0, "radius": 5.0, "life": 30.0, "size": 0.9,
}

const BARRAGE := {
	"id": "barrage", "name": "ROCKET BARRAGE", "slot": "ultimate", "kind": "barrage",
	"count": 6, "interval": 0.09, "targets": "ahead", "max_targets": 3, "range": 140.0,
	"projectile": {"speed": 66.0, "launch_speed": 30.0, "rise_time": 0.4, "turn": 4.0, "life": 3.5,
		"damage": 11.0, "radius": 4.5, "size": 0.62, "fuse": 1.8, "charges_ult": false},
}

## how the ULT meter charges (fraction of a full meter)
const ULT_GAIN := {"hit": 0.1, "wreck": 0.25, "near_miss": 0.08, "drift_per_s": 0.03}

static func default_loadout() -> Dictionary:
	return {"front": ROCKET.duplicate(true), "rear": MINE.duplicate(true), "ultimate": BARRAGE.duplicate(true)}
