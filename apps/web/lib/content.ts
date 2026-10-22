import "server-only";
import {cache} from "react";
import {createContentService} from "@sohoin/core/server";
import {registerCustom} from "@sohoin/custom/register";
const service=createContentService(registerCustom().contentTypes??[]);
export const contentService={...service,getPublic:cache(service.getPublic)};
