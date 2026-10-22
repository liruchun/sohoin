import {settingsOpenApi} from "@sohoin/extension-api/openapi";
export function GET(){return Response.json(settingsOpenApi());}
