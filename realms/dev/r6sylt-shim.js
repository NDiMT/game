// dev-only shim: serves Sylvan buildings where town_view.js asks for Haven ones (preview only)
export { sylvanTownBuilding as havenTownBuilding, SYLVAN_TOWN_IDS as HAVEN_TOWN_IDS } from '../sylvan_town.js';
