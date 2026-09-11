# HA House Status Card

A compact, glass-styled Home Assistant Lovelace card giving a single at-a-glance overview of the house: locks, doors/windows, alarm, garage door, who's home, running appliances, and robots.

## Install

Add `ha-house-status-card.js` to `/config/www/ha-house-status-card/` and register it as a Lovelace resource (type: module).

## Example configuration

```yaml
type: custom:ha-house-status-card
title: Husets status
locks:
  - entity: lock.front_door
    name: Front door
door_entities:
  - binary_sensor.terrace_door
  - binary_sensor.kitchen_window
open_count_entity: sensor.open_windows
alarm_entity: alarm_control_panel.house_alarm
garage_entity: cover.garage_door
persons:
  - entity: person.jane
    name: Jane
appliances:
  - entity: binary_sensor.washing_machine_running
    name: Washing machine
robots:
  - entity: vacuum.robot
    name: Robot
    error_entity: sensor.robot_error
security_path: /dashboard/security
robots_path: /dashboard/robots
```

All fields are optional — the card only renders tiles for the categories you configure.
