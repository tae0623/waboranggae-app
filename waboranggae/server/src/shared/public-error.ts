/** Only intentional, fixed service messages may cross the production error boundary. */
export class RequiredVisitError extends Error {
  readonly code='REQUIRED_VISIT';
  constructor(message:string,readonly status:422|503=422){super(message);this.name='RequiredVisitError';}
}
