var e=`it_no_mobile`;function t(t){typeof document>`u`||(t?document.cookie=`${e}=1; path=/; max-age=${3600*24*30}; samesite=lax`:document.cookie=`${e}=; path=/; max-age=0; samesite=lax`)}var n=`(function(){
  try {
    var NO = 'it_no_mobile';
    function hasOptOut() {
      return document.cookie.split('; ').some(function(c){return c.indexOf(NO + '=1') === 0});
    }
    if (hasOptOut()) return;
    var ua = navigator.userAgent || '';
    function isMobileUA(u) {
      if (/iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(u)) return true;
      if (/iPad/i.test(u)) return true;
      if (/Macintosh/i.test(u) && navigator.maxTouchPoints > 1) return true;
      return false;
    }
    var w = Math.min(window.innerWidth || 9999, (window.screen && window.screen.width) || 9999);
    if (!isMobileUA(ua) || w >= 768) return;
    var path = window.location.pathname || '/';
    // Public routes get mirrored to /m/... — internal app routes
    // (dashboard, profile, post-job, manage, apply) get the same
    // prefix so the URL stays predictable.
    var map = {
      '/': '/m',
      '/jobs': '/m/jobs',
    };
    var target = null;
    for (var k in map) {
      if (path === k) { target = map[k]; break; }
    }
    if (path.indexOf('/jobs/') === 0) target = '/m/jobs' + path.slice('/jobs'.length);
    if (path.indexOf('/apply/') === 0) target = '/m' + path;
    if (path.indexOf('/dashboard') === 0) target = '/m/home';
    if (path.indexOf('/profile') === 0) target = '/m/profile';
    if (path.indexOf('/post-job') === 0) target = '/m/post';
    if (path.indexOf('/edit-job/') === 0) target = '/m/home';
    if (path.indexOf('/manage/') === 0) target = '/m/home';
    if (target && target !== path) {
      window.location.replace(target + window.location.search + window.location.hash);
    }
  } catch(e) { /* never block the app on a UA parsing failure */ }
})();`;export{t as n,n as t};