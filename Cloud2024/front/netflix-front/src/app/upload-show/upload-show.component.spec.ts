import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadShowComponent } from './upload-show.component';

describe('UploadShowComponent', () => {
  let component: UploadShowComponent;
  let fixture: ComponentFixture<UploadShowComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [UploadShowComponent]
    });
    fixture = TestBed.createComponent(UploadShowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
