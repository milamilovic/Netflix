import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewShowComponent } from './view-show.component';

describe('ViewShowComponent', () => {
  let component: ViewShowComponent;
  let fixture: ComponentFixture<ViewShowComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ViewShowComponent]
    });
    fixture = TestBed.createComponent(ViewShowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
