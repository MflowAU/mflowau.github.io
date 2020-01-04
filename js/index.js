function fileClosure() {
  
  const page = document;
  
  function elem(selector, parent = document){
    let elem = document.querySelector(selector);
    return elem != false ? elem : false;
  }
  
  function elems(selector) {
    let elems = document.querySelectorAll(selector);
    return elems.length ? elems : false; 
  }
  
  function pushClass(el, targetClass) {
    // equivalent to addClass
    if (el && typeof el == 'object' && targetClass) {
      elClass = el.classList;
      elClass.contains(targetClass) ? false : elClass.add(targetClass);
    }
  }
  
  function deleteClass(el, targetClass) {
    // equivalent to removeClass
    if (el && typeof el == 'object' && targetClass) {
      elClass = el.classList;
      elClass.contains(targetClass) ? elClass.remove(targetClass) : false;
    }
  }
  
  function modifyClass(el, targetClass) {
    // equivalent to toggleClass
    if (el && typeof el == 'object' && targetClass) {
      elClass = el.classList;
      elClass.contains(targetClass) ? elClass.remove(targetClass) : elClass.add(targetClass);
    }
  }
  
  function containsClass(el, targetClass) {
    if (el && typeof el == 'object' && targetClass) {
      return el.classList.contains(targetClass) ? true : false;
    }
  }
  
  function createEl(element = 'div') {
    return document.createElement(element);
  }
  
  (function slideControls() {
    const control = 'control';
    const rt = 'rt';
    let left = createEl();
    let right = createEl();
    let controls = createEl();
  
    left.className = control;
    left.classList.add(rt);
    right.className = control;
    controls.className = 'control_wrap';

    controls.appendChild(left)
    controls.appendChild(right);
    
    const articles = elem('.articles_wrap');
    if(articles) {
      articles.insertAdjacentElement('afterend', controls);
    }
    
    const slider = elem('.articles');
    if (slider) {
      const slideWidth = slider.children[0].offsetWidth;
      let offset = 0;
      console.log(slideWidth * slider.children.length)
      const sliderOverflow = (slideWidth * slider.children.length - 1) - slider.offsetWidth;
      page.addEventListener('click', function(event) {
        let target = event.target;
        let x = 0
        let y = 0
        
        function moveSlider() {
          if (target.matches(`.${rt}`)) {
            offset > 0 ? x++ : false;
            offset -= slideWidth * x;
          } else {
            offset <= sliderOverflow ? y++ : false;
            offset += slideWidth * y;
          }
          // slider.scrollLeft = offset;
          slider.style.transform = `translateX(-${offset}px)`;
        }
        
        if (target.matches(`.${control}`)) {
          window.requestAnimationFrame(moveSlider);
        }
      });
    }
    
  })();
  
  function populateAlt(images) {
    images.forEach((image) => {
      if (image.alt.length > 10 && !containsClass(image, 'alt')) {
        let desc = document.createElement('p');
        desc.classList.add('thumb_alt');
        desc.textContent = image.alt;
        image.insertAdjacentHTML('afterend', desc.outerHTML);
      }
    });
  }
  
  (function AltImage() {
    let post = elem('main');
    let images = post ? post.querySelectorAll('img') : false;
    images ? populateAlt(images) : false;
  })();
  
  
  function toggleMenu() {
    const open = 'nav_open';
    const nav = elem('.nav');
    modifyClass(nav, open);
  }
  
  page.addEventListener('click', function(event) {
    const toggle = '.nav_toggle';
    const target = event.target;
    target.matches(toggle) ? toggleMenu() : false;
  });
  
  // click dot
  // save dot id
  // use dot id to determine previous click
  // rest scrolling to opposite side is
}

window.addEventListener('load', fileClosure());
