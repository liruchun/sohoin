import "server-only";
import {cache} from "react";
import {createSettingsService} from "@sohoin/core/server";
import {registerCustom} from "@sohoin/custom/register";
const service=createSettingsService(registerCustom().settingsDefaults);
export const settingsService={...service,readPublic:cache(service.readPublic)};
