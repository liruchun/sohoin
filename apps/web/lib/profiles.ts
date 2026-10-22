import "server-only";
import {createProfileService} from "@sohoin/core/server";
import {registerCustom} from "@sohoin/custom/register";
export const profileService=createProfileService(registerCustom().profileExtension);
