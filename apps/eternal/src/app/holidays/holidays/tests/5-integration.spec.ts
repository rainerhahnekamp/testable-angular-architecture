import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, fakeAsync, flush, TestBed, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { HolidaysEffects } from '../../+state/holidays.effects';
import { holidaysFeatureKey, holidaysReducer } from '../../+state/holidays.reducer';
import { AddressGetterComponent } from '../../address-getter/address-getter.component';
import { createHoliday } from '../../holiday';
import { HolidaysComponent } from '../holidays.component';

describe('Holidays integration test', () => {
  const setup = () => {
    const fixture = TestBed.configureTestingModule({
      declarations: [HolidaysComponent, AddressGetterComponent],
      imports: [
        NoopAnimationsModule,
        MatCardModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSnackBarModule,
        HttpClientTestingModule,
        ReactiveFormsModule,
        StoreModule.forRoot({ [holidaysFeatureKey]: holidaysReducer }),
        EffectsModule.forRoot([HolidaysEffects])
      ]
    }).createComponent(HolidaysComponent);
    fixture.detectChanges();
    const httpController = TestBed.inject(HttpTestingController);
    return { fixture, httpController };
  };
  it('should instantiate', () => {
    const { fixture } = setup();
    expect(fixture).toBeInstanceOf(ComponentFixture);
  });

  it('should show holidays', () => {
    const { fixture, httpController } = setup();

    const req = httpController.expectOne((req) => !!req.url.match(/holidays/));
    req.flush([createHoliday({ title: 'Paris' }), createHoliday({ title: 'Rome / Roma' })]);
    fixture.detectChanges();

    const holidayTitles = fixture.debugElement
      .queryAll(By.css('mat-card-title'))
      .map((matCardTitle) => (matCardTitle.nativeElement as HTMLElement).textContent);

    expect(holidayTitles).toEqual(['Paris', 'Rome / Roma']);
  });

  it('should send the brochure if a valid address is given', fakeAsync(() => {
    const { fixture, httpController } = setup();
    const holidaysReq = httpController.expectOne('/assets/holidays.json');
    holidaysReq.flush([createHoliday({ id: 5 })]);
    fixture.detectChanges();

    // select holiday
    const brochureButton = fixture.debugElement.query(By.css('[data-test=btn-brochure]'))
      .nativeElement as HTMLButtonElement;
    brochureButton.click();
    fixture.detectChanges();

    // fill in address
    const input = fixture.debugElement.query(By.css('[data-test=address]'))
      .nativeElement as HTMLInputElement;
    input.value = 'Domgasse 5, 1010 Wien';
    input.dispatchEvent(new CustomEvent('input'));
    tick(250);
    const addressReq = httpController.expectOne((req) => !!req.url.match(/nominatim/));
    addressReq.flush([true]);
    fixture.detectChanges();
    const addressSubmit = fixture.debugElement.query(By.css('[data-test=btn-submit]'))
      .nativeElement as HTMLButtonElement;
    addressSubmit.click();
    fixture.detectChanges();

    // confirm sending
    const snackBar = TestBed.inject(MatSnackBar);
    const snackBarSpie = jest.spyOn(snackBar, 'open');
    const sendReq = httpController.expectOne((req) => {
      expect(req.url).toBe('/holidays/send-brochure');
      expect(req.body).toEqual({
        address: 'Domgasse 5, 1010 Wien',
        holidayId: 5
      });
      return true;
    });
    sendReq.flush(true);
    flush();
    fixture.detectChanges();

    expect(snackBarSpie).toHaveBeenCalledWith('Brochure has been sent. Thank you!', 'OK');
  }));
});
