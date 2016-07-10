import {IdentityRef} from "VSS/WebApi/Contracts";

export interface ITeamAreaPaths {
    team: string;
    areaPaths: string[];
}

export interface ITeamMembers {
    team: string;
    members: IdentityRef[];
}